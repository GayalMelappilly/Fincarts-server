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
    
    if (!Array.isArray(d) || d.length === 0) {
        return 0;
    }

    // Join all parts of d as a string
    const digitsStr = d.join('');
    const totalDigits = digitsStr.length;

    // Calculate actual number using exponent
    const floatVal = parseFloat(digitsStr) * Math.pow(10, e - totalDigits);

    console.log('Finall value : ', floatVal*10)

    return s === 1 ? floatVal*10 : -floatVal*10;
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