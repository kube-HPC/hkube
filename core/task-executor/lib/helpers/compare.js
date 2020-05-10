const lessWithTolerance = (a, b, tolerance = 0.01) => {
    return (a - b) < tolerance;
};

module.exports = {
    lessWithTolerance
};
