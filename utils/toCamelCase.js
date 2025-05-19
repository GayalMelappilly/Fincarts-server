const toCamelCase = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};


const isPriceObject = (value) => {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        's' in value &&
        'e' in value &&
        'd' in value
    );
};


const convertPriceToNumber = (priceObj) => {
    const { s, e, d } = priceObj;
    
    // Handle empty digits array
    if (!Array.isArray(d) || d.length === 0) {
        return 0;
    }
    
    // Combine digits into a number
    let value = 0;
    for (let i = 0; i < d.length; i++) {
        value = value * 10 + d[i];
    }
    
    // Apply exponent
    value = value * Math.pow(10, e);
    
    // Apply sign
    return s === 1 ? value : -value;
};


export const transformToCamelCase = (data) => {
    if (data === null || data === undefined) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => transformToCamelCase(item));
    }

    // Handle price object special case
    if (isPriceObject(data)) {
        return convertPriceToNumber(data);
    }

    // Handle regular object
    if (typeof data === 'object') {
        const newObj = {};

        Object.keys(data).forEach(key => {
            const camelKey = toCamelCase(key);
            
            // Check if this is a price field by key name
            const value = data[key];
            if (key === 'price' || key.endsWith('_price') || key.includes('price_') || key.includes('amount')) {
                if (isPriceObject(value)) {
                    newObj[camelKey] = convertPriceToNumber(value);
                    return;
                }
            }
            
            // Process normally
            newObj[camelKey] = transformToCamelCase(value);
        });

        return newObj;
    }

    return data;
};