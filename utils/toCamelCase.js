
const toCamelCase = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};


export const transformToCamelCase = (data) => {
    if (data === null || data === undefined) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => transformToCamelCase(item));
    }

    if (typeof data === 'object') {
        const newObj = {};

        Object.keys(data).forEach(key => {
            const camelKey = toCamelCase(key);
            newObj[camelKey] = transformToCamelCase(data[key]);
        });

        return newObj;
    }

    return data;
};
