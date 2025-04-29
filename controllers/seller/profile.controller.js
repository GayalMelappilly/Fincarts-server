import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../utils/bcrypt.js";
import prisma from "../../utils/prisma.js";

export const sellerCreateProfile = async (req, res) => {
    const sellerData = req.body;
    console.log("DATA: ", sellerData);

    try {
        // Hash the password first (outside transaction)
        const hashedPassword = await hashPassword(sellerData.password);
        console.log(hashedPassword);

        // Use a transaction with explicit timeout
        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create location
            const location = await prisma.seller_locations.create({
                data: {
                    latitude: 0,
                    longitude: 0,
                    pin_code: sellerData.address.pin_code,
                    city: sellerData.address.city,
                    state: sellerData.address.state,
                    country: sellerData.address.country
                }
            });

            // 2. Create address
            const address = await prisma.seller_addresses.create({
                data: {
                    location_id: location.location_id,
                    address_line1: sellerData.address.address_line1,
                    address_line2: sellerData.address.address_line2,
                    landmark: sellerData.address.landmark,
                    is_default: true,
                    address_type: 'BUSINESS'
                }
            });

            // 3. Create seller with all relations
            return await prisma.sellers.create({
                data: {
                    business_name: sellerData.business_name,
                    business_type: sellerData.business_type,
                    email: sellerData.email,
                    phone: sellerData.phone,
                    alternate_phone: sellerData.alternate_phone,
                    gstin: sellerData.gstin,
                    pan_card: sellerData.pan_card,
                    legal_business_name: sellerData.legal_business_name,
                    display_name: sellerData.display_name,
                    store_description: sellerData.store_description,
                    logo_url: sellerData.logo_url,
                    website_url: sellerData.website_url,
                    primary_address_id: address.address_id,
                    bank_account_number: sellerData.bank_details.account_number,
                    bank_ifsc_code: sellerData.bank_details.ifsc_code,
                    bank_account_holder_name: sellerData.bank_details.account_holder_name,
                    password_hash: hashedPassword,
                    seller_settings: {
                        create: {
                            auto_accept_orders: true,
                            default_warranty_period: 0,
                            return_window: 7,
                            min_order_value: 0
                        }
                    },
                    seller_payment_settings: {
                        create: {
                            payment_cycle: 'WEEKLY',
                            min_payout_amount: 100.0
                        }
                    },
                    seller_metrics: {
                        create: {
                            total_sales: 0,
                            total_orders: 0,
                            avg_rating: 0,
                            total_listings: 0,
                            active_listings: 0
                        }
                    }
                },
                include: {
                    seller_addresses: true,
                    seller_settings: true,
                    seller_payment_settings: true,
                    seller_metrics: true
                }
            });
        }, {
            maxWait: 5000, // Maximum time to wait for the transaction
            timeout: 10000 // Maximum time for the transaction to complete
        });

        return res.status(201).json({
            success: true,
            data: result,
            message: 'Seller created successfully'
        });

    } catch (error) {
        console.error('Error creating seller:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to create seller'
        });
    }
};