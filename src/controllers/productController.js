// src/controllers/productController.js
const Product = require('../models/Product');
const SerialPin = require('../models/SerialPin');

class ProductController {
  // Get all products with pagination and filtering
  static async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        search,
        minPrice,
        maxPrice,
        sort = 'createdAt',
        order = 'desc',
        isActive = true
      } = req.query;

      const skip = (page - 1) * limit;
      const query = { isActive: isActive === 'true' };

      // Add filters
      if (category) {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Create sort object
      const sortObj = {};
      sortObj[sort] = order.toLowerCase() === 'desc' ? -1 : 1;

      // Execute queries
      const [products, totalCount] = await Promise.all([
        Product.find(query)
          .select('-__v')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Product.countDocuments(query)
      ]);

      // Add stock information for each product
      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          let availableStock = 0;
          
          if (product.category === 'checker') {
            // For checker products, count unused serial pins
            availableStock = await SerialPin.countDocuments({
              productId: product._id,
              isUsed: false,
              orderId: null
            });
          } else {
            // For other products, use stockQuantity
            availableStock = product.stockQuantity || 0;
          }

          return {
            ...product,
            availableStock,
            inStock: availableStock > 0,
            discountPercentage: product.originalPrice && product.originalPrice > product.price
              ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
              : 0
          };
        })
      );

      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          products: productsWithStock,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: totalCount,
            itemsPerPage: parseInt(limit),
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get single product by ID
  static async getProductById(req, res) {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID format'
        });
      }

      const product = await Product.findOne({
        _id: id,
        isActive: true
      }).select('-__v').lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Add stock information
      let availableStock = 0;
      
      if (product.category === 'checker') {
        availableStock = await SerialPin.countDocuments({
          productId: product._id,
          isUsed: false,
          orderId: null
        });
      } else {
        availableStock = product.stockQuantity || 0;
      }

      const productWithStock = {
        ...product,
        availableStock,
        inStock: availableStock > 0,
        discountPercentage: product.originalPrice && product.originalPrice > product.price
          ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
          : 0
      };

      res.json({
        success: true,
        data: {
          product: productWithStock
        }
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get product categories
  static async getCategories(req, res) {
    try {
      const categories = await Product.distinct('category', { isActive: true });

      res.json({
        success: true,
        data: { 
          categories: categories.filter(cat => cat) // Remove null/undefined values
        }
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get featured products
  static async getFeaturedProducts(req, res) {
    try {
      const { limit = 6 } = req.query;

      const products = await Product.find({ isActive: true })
        .select('-__v')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Add stock information
      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          let availableStock = 0;
          
          if (product.category === 'checker') {
            availableStock = await SerialPin.countDocuments({
              productId: product._id,
              isUsed: false,
              orderId: null
            });
          } else {
            availableStock = product.stockQuantity || 0;
          }

          return {
            ...product,
            availableStock,
            inStock: availableStock > 0,
            discountPercentage: product.originalPrice && product.originalPrice > product.price
              ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
              : 0
          };
        })
      );

      res.json({
        success: true,
        data: { 
          products: productsWithStock 
        }
      });
    } catch (error) {
      console.error('Get featured products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch featured products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Search products
  static async searchProducts(req, res) {
    try {
      const { q, category, limit = 10 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      const query = {
        isActive: true,
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } }
        ]
      };

      if (category) {
        query.category = category;
      }

      const products = await Product.find(query)
        .select('name price originalPrice image category')
        .sort({ name: 1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: {
          products: products,
          searchQuery: q,
          count: products.length
        }
      });
    } catch (error) {
      console.error('Search products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get low stock products (for admin dashboard)
  static async getLowStockProducts(req, res) {
    try {
      const { limit = 5 } = req.query;

      const products = await Product.find({
        isActive: true,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
      })
        .select('-__v')
        .sort({ stockQuantity: 1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: { 
          products: products 
        }
      });
    } catch (error) {
      console.error('Get low stock products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch low stock products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get product statistics
  static async getProductStats(req, res) {
    try {
      const [
        totalProducts,
        activeProducts,
        lowStockCount,
        categoryStats
      ] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ isActive: true }),
        Product.countDocuments({
          isActive: true,
          $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
        }),
        Product.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ])
      ]);

      const stats = {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        lowStockCount,
        categoryBreakdown: categoryStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get product stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ProductController;