
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.6.0
 * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
 */
Prisma.prismaVersion = {
  client: "6.6.0",
  engine: "f676762280b54cd07c770017ed3711ddde35f37a"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.Cart_itemsScalarFieldEnum = {
  id: 'id',
  cart_id: 'cart_id',
  fish_listing_id: 'fish_listing_id',
  quantity: 'quantity',
  added_at: 'added_at'
};

exports.Prisma.Fish_categoriesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  image_url: 'image_url',
  parent_category_id: 'parent_category_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Fish_listingsScalarFieldEnum = {
  id: 'id',
  seller_id: 'seller_id',
  category_id: 'category_id',
  name: 'name',
  description: 'description',
  price: 'price',
  quantity_available: 'quantity_available',
  images: 'images',
  age: 'age',
  size: 'size',
  color: 'color',
  breed: 'breed',
  is_featured: 'is_featured',
  created_at: 'created_at',
  updated_at: 'updated_at',
  listing_status: 'listing_status',
  care_instructions: 'care_instructions',
  dietary_requirements: 'dietary_requirements',
  view_count: 'view_count'
};

exports.Prisma.Order_itemsScalarFieldEnum = {
  id: 'id',
  order_id: 'order_id',
  fish_listing_id: 'fish_listing_id',
  quantity: 'quantity',
  unit_price: 'unit_price',
  total_price: 'total_price',
  created_at: 'created_at'
};

exports.Prisma.OrdersScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  total_amount: 'total_amount',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at',
  shipping_details_id: 'shipping_details_id',
  payment_details_id: 'payment_details_id',
  points_earned: 'points_earned',
  points_used: 'points_used',
  discount_amount: 'discount_amount',
  coupon_code: 'coupon_code',
  order_notes: 'order_notes'
};

exports.Prisma.Payment_detailsScalarFieldEnum = {
  id: 'id',
  payment_method: 'payment_method',
  transaction_id: 'transaction_id',
  status: 'status',
  payment_date: 'payment_date',
  payment_metadata: 'payment_metadata',
  created_at: 'created_at'
};

exports.Prisma.Refresh_tokensScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  token: 'token',
  expires_at: 'expires_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ReviewsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  fish_listing_id: 'fish_listing_id',
  rating: 'rating',
  review_text: 'review_text',
  review_images: 'review_images',
  created_at: 'created_at',
  is_verified_purchase: 'is_verified_purchase',
  order_id: 'order_id'
};

exports.Prisma.Seller_metricsScalarFieldEnum = {
  id: 'id',
  seller_id: 'seller_id',
  total_sales: 'total_sales',
  total_orders: 'total_orders',
  avg_rating: 'avg_rating',
  total_listings: 'total_listings',
  active_listings: 'active_listings',
  last_calculated_at: 'last_calculated_at'
};

exports.Prisma.Seller_sales_historyScalarFieldEnum = {
  id: 'id',
  seller_id: 'seller_id',
  date: 'date',
  daily_sales: 'daily_sales',
  order_count: 'order_count',
  new_customers: 'new_customers',
  cancellations: 'cancellations',
  created_at: 'created_at'
};

exports.Prisma.Shipping_detailsScalarFieldEnum = {
  id: 'id',
  carrier: 'carrier',
  tracking_number: 'tracking_number',
  shipping_cost: 'shipping_cost',
  estimated_delivery: 'estimated_delivery',
  actual_delivery: 'actual_delivery',
  shipping_method: 'shipping_method',
  shipping_notes: 'shipping_notes',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Shopping_cartsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  is_active: 'is_active',
  abandoned_cart_reminder_sent: 'abandoned_cart_reminder_sent'
};

exports.Prisma.User_addressesScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  city: 'city',
  state: 'state',
  postal_code: 'postal_code',
  country: 'country',
  is_default: 'is_default',
  latitude: 'latitude',
  longitude: 'longitude',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UsersScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password_hash: 'password_hash',
  full_name: 'full_name',
  phone_number: 'phone_number',
  user_type: 'user_type',
  created_at: 'created_at',
  updated_at: 'updated_at',
  email_verified: 'email_verified',
  phone_verified: 'phone_verified',
  points_balance: 'points_balance',
  profile_picture_url: 'profile_picture_url'
};

exports.Prisma.Wishlist_itemsScalarFieldEnum = {
  id: 'id',
  wishlist_id: 'wishlist_id',
  fish_listing_id: 'fish_listing_id',
  added_at: 'added_at',
  notes: 'notes'
};

exports.Prisma.WishlistsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  name: 'name',
  is_public: 'is_public',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Seller_addressesScalarFieldEnum = {
  address_id: 'address_id',
  location_id: 'location_id',
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  landmark: 'landmark',
  is_default: 'is_default',
  address_type: 'address_type',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Seller_documentsScalarFieldEnum = {
  document_id: 'document_id',
  seller_id: 'seller_id',
  document_type: 'document_type',
  document_url: 'document_url',
  verification_status: 'verification_status',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Seller_locationsScalarFieldEnum = {
  location_id: 'location_id',
  latitude: 'latitude',
  longitude: 'longitude',
  pin_code: 'pin_code',
  city: 'city',
  state: 'state',
  country: 'country',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Seller_payment_settingsScalarFieldEnum = {
  payment_setting_id: 'payment_setting_id',
  seller_id: 'seller_id',
  payment_cycle: 'payment_cycle',
  min_payout_amount: 'min_payout_amount',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Seller_settingsScalarFieldEnum = {
  setting_id: 'setting_id',
  seller_id: 'seller_id',
  auto_accept_orders: 'auto_accept_orders',
  default_warranty_period: 'default_warranty_period',
  return_window: 'return_window',
  shipping_provider: 'shipping_provider',
  min_order_value: 'min_order_value',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SellersScalarFieldEnum = {
  seller_id: 'seller_id',
  business_name: 'business_name',
  business_type: 'business_type',
  email: 'email',
  phone: 'phone',
  alternate_phone: 'alternate_phone',
  gstin: 'gstin',
  pan_card: 'pan_card',
  legal_business_name: 'legal_business_name',
  display_name: 'display_name',
  store_description: 'store_description',
  logo_url: 'logo_url',
  website_url: 'website_url',
  primary_address_id: 'primary_address_id',
  status: 'status',
  bank_account_number: 'bank_account_number',
  bank_ifsc_code: 'bank_ifsc_code',
  bank_account_holder_name: 'bank_account_holder_name',
  commission_rate: 'commission_rate',
  seller_rating: 'seller_rating',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  cart_items: 'cart_items',
  fish_categories: 'fish_categories',
  fish_listings: 'fish_listings',
  order_items: 'order_items',
  orders: 'orders',
  payment_details: 'payment_details',
  refresh_tokens: 'refresh_tokens',
  reviews: 'reviews',
  seller_metrics: 'seller_metrics',
  seller_sales_history: 'seller_sales_history',
  shipping_details: 'shipping_details',
  shopping_carts: 'shopping_carts',
  user_addresses: 'user_addresses',
  users: 'users',
  wishlist_items: 'wishlist_items',
  wishlists: 'wishlists',
  seller_addresses: 'seller_addresses',
  seller_documents: 'seller_documents',
  seller_locations: 'seller_locations',
  seller_payment_settings: 'seller_payment_settings',
  seller_settings: 'seller_settings',
  sellers: 'sellers'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
