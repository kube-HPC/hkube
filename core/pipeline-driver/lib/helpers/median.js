module.exports = {
    median(array) {
        if (!array || array.length === 0) {
            return 0;
        }
        array.sort((a, b) => a - b);
        const half = Math.floor(array.length / 2);
        const median = array.length % 2 ? array[half] : (array[half - 1] + array[half]) / 2.0;
        return median;
    }
};
