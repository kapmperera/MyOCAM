export function calculateMean(data) {
  if (!data || data.length === 0) return 0;
  const sum = data.reduce((acc, val) => acc + val, 0);
  return sum / data.length;
}

export function calculateMedian(data) {
  if (!data || data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateMode(data) {
  if (!data || data.length === 0) return 0;
  const counts = {};
  let maxFreq = 0;
  let mode = null;
  data.forEach(val => {
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxFreq) {
      maxFreq = counts[val];
      mode = val;
    }
  });
  return mode;
}

export function calculateVariance(data, mean) {
  if (!data || data.length <= 1) return 0;
  const sqDiffs = data.map(val => Math.pow(val - mean, 2));
  const sumSq = sqDiffs.reduce((acc, val) => acc + val, 0);
  return sumSq / (data.length - 1); // Sample variance
}

export function calculateStdDev(variance) {
  return Math.sqrt(variance);
}

export function calculateSkewness(data, mean, stdDev) {
  if (!data || data.length <= 2 || stdDev === 0) return 0;
  const n = data.length;
  const sumCubedDiffs = data.reduce((acc, val) => acc + Math.pow(val - mean, 3), 0);
  return (n * sumCubedDiffs) / ((n - 1) * (n - 2) * Math.pow(stdDev, 3)); // Sample skewness
}

export function calculateKurtosis(data, mean, stdDev) {
  if (!data || data.length <= 3 || stdDev === 0) return 0;
  const n = data.length;
  const sumQuadDiffs = data.reduce((acc, val) => acc + Math.pow(val - mean, 4), 0);
  // Sample Excess Kurtosis
  const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const factor2 = sumQuadDiffs / Math.pow(stdDev, 4);
  const factor3 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return factor1 * factor2 - factor3;
}

export function analyzeDistribution(skewness, kurtosis) {
  let shape = "Approximately Normal";
  let reason = "The skewness is close to 0 (-0.5 to 0.5), indicating a symmetric bell shape.";

  if (skewness < -0.5) {
    shape = "Left-Skewed (Negative)";
    reason = "The distribution has a long tail on the left side, meaning most students scored higher than average, but a few very low scores are dragging the mean down.";
  } else if (skewness > 0.5) {
    shape = "Right-Skewed (Positive)";
    reason = "The distribution has a long tail on the right side, meaning most students scored lower than average, but a few high scores are pushing the mean up.";
  }

  let tailWeight = "Normal tail weights.";
  if (kurtosis > 1) {
    tailWeight = "The distribution is Leptokurtic, meaning there are more extreme outliers than a normal bell curve.";
  } else if (kurtosis < -1) {
    tailWeight = "The distribution is Platykurtic, meaning the scores are more spread out and flatter than a normal bell curve.";
  }

  return { shape, reason, tailWeight };
}

export function calculateAdjustment(studentsData) {
  // studentsData expects array of objects: { id, originalMark }
  const marks = studentsData.map(s => s.originalMark);
  const mean = calculateMean(marks);
  const max = Math.max(...marks);
  const targetMean = 55; // Academic standard mean

  let method = "None";
  let recommendedConstant = 0;
  let adjustedData = studentsData.map(s => ({ ...s, adjustedMark: s.originalMark }));

  if (mean < targetMean) {
    // 1. Try Constant Flat Addition
    const gap = targetMean - mean;
    if (max + gap <= 100) {
      method = "Flat Constant Addition";
      recommendedConstant = Number(gap.toFixed(1));
      adjustedData = studentsData.map(s => ({
        ...s,
        adjustedMark: Math.min(100, Number((s.originalMark + gap).toFixed(1)))
      }));
    } else {
      // 2. Linear Scaling if Flat Addition exceeds 100
      method = "Linear Scaling";
      const scaleFactor = (100 - targetMean) / (max - mean);
      adjustedData = studentsData.map(s => {
        let adj = targetMean + (s.originalMark - mean) * scaleFactor;
        return { ...s, adjustedMark: Math.min(100, Math.max(0, Number(adj.toFixed(1)))) };
      });
    }
  } else {
     method = "Z-Score Percentile Curve Adjustment";
     // Apply Z-Score normalization centered around targetMean
     const variance = calculateVariance(marks, mean);
     const stdDev = calculateStdDev(variance);
     const targetStdDev = 15; // standard deviation for an academic curve
     adjustedData = studentsData.map(s => {
       if (stdDev === 0) return { ...s, adjustedMark: s.originalMark };
       const zScore = (s.originalMark - mean) / stdDev;
       let adj = targetMean + (zScore * targetStdDev);
       return { ...s, adjustedMark: Math.min(100, Math.max(0, Number(adj.toFixed(1)))) };
     });
  }

  const adjMarks = adjustedData.map(s => s.adjustedMark);
  const adjMean = calculateMean(adjMarks);
  const adjVar = calculateVariance(adjMarks, adjMean);
  const adjStdDev = calculateStdDev(adjVar);

  return {
    method,
    recommendedConstant,
    adjustedData,
    afterStats: {
      mean: adjMean,
      median: calculateMedian(adjMarks),
      mode: calculateMode(adjMarks),
      stdDev: adjStdDev,
      skewness: calculateSkewness(adjMarks, adjMean, adjStdDev),
      kurtosis: calculateKurtosis(adjMarks, adjMean, adjStdDev)
    }
  };
}

// ----------------------------------------------------
// NEW ADVANCED GAUSSIAN & ALIGNMENT ANALYTICS SOLVERS
// ----------------------------------------------------

/**
 * Standard Normal CDF approximation (using rational approximation)
 */
export function normalCdf(x, mean, stdDev) {
  if (stdDev === 0) return x < mean ? 0 : 1;
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.39894228 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Inverse Normal CDF (Quantile / Percent Point Function) approximation
 */
export function normalPercentilePoint(p, mean, stdDev) {
  if (p <= 0.0001) return Math.max(0, mean - 3.5 * stdDev);
  if (p >= 0.9999) return Math.min(100, mean + 3.5 * stdDev);
  
  // Rational approximation
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  let z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  if (p < 0.5) z = -z;
  
  const val = mean + z * stdDev;
  return Math.min(100, Math.max(0, val));
}

/**
 * Calculate expected student count in ranges based on ideal normal curve
 */
export function getExpectedNormalCounts(mean, stdDev, N, bins) {
  if (stdDev === 0) return bins.map(() => 0);
  return bins.map(bin => {
    const pUpper = normalCdf(bin.max, mean, stdDev);
    const pLower = normalCdf(bin.min, mean, stdDev);
    const prob = Math.max(0, pUpper - pLower);
    return Number((prob * N).toFixed(2));
  });
}

/**
 * Calculate similarity / goodness-of-fit score (0 - 100)
 */
export function calculateDistributionFitScore(actualCounts, expectedCounts) {
  if (!actualCounts || actualCounts.length === 0) return 0;
  let sumSqErr = 0;
  let sumExpectedSq = 0;
  
  for (let i = 0; i < actualCounts.length; i++) {
    const err = actualCounts[i] - expectedCounts[i];
    sumSqErr += err * err;
    sumExpectedSq += expectedCounts[i] * expectedCounts[i];
  }
  
  if (sumExpectedSq === 0) return 0;
  const nmse = sumSqErr / sumExpectedSq;
  // Map error to 0-100 score: 100 represents perfect fit (0 error)
  const fitScore = Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(Math.min(1, nmse))) * 100)));
  return fitScore;
}

/**
 * Solves for the optimal uniform shift (constant add / scale) to maximize fit score
 */
export function calculateOptimalUniformCohortAdjustment(rawMarks, bins) {
  if (!rawMarks || rawMarks.length === 0) return { constant: 0, scale: 1, bestScore: 0 };
  const origMean = calculateMean(rawMarks);
  const origStdDev = calculateStdDev(calculateVariance(rawMarks, origMean));
  const N = rawMarks.length;

  let bestConstant = 0;
  let bestScale = 1;
  let bestScore = 0;

  // Let's sweep potential constants and scales
  const constants = [-10, -5, 0, 2, 5, 8, 10, 12, 15, 20];
  const scales = [0.8, 0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3];

  constants.forEach(c => {
    scales.forEach(s => {
      // Calculate adjusted marks
      const adjMarks = rawMarks.map(m => Math.min(100, Math.max(0, Number(((m * s) + c).toFixed(1)))));
      const adjMean = calculateMean(adjMarks);
      const adjVar = calculateVariance(adjMarks, adjMean);
      const adjStdDev = calculateStdDev(adjVar);

      // Bin counts
      const actCounts = bins.map(() => 0);
      adjMarks.forEach(mark => {
        const binIdx = bins.findIndex(b => mark >= b.min && mark <= b.max);
        if (binIdx !== -1) actCounts[binIdx]++;
      });

      const expCounts = getExpectedNormalCounts(adjMean, adjStdDev, N, bins);
      const score = calculateDistributionFitScore(actCounts, expCounts);

      if (score > bestScore) {
        bestScore = score;
        bestConstant = c;
        bestScale = s;
      }
    });
  });

  return {
    constant: bestConstant,
    scale: bestScale,
    bestScore
  };
}

/**
 * Solves student-level adjustment offsets to force distribution to fit normal curve perfectly
 */
export function calculateStudentLevelAdjustmentOffsets(students, targetMean = 60, targetStdDev = 15) {
  if (!students || students.length === 0) return [];
  
  // Sort students by original marks to assign normal quantiles based on percentile ranks
  const sortedStudents = [...students]
    .map((s, idx) => ({ ...s, originalIdx: idx }))
    .sort((a, b) => a.mark - b.mark);

  const N = sortedStudents.length;

  const adjusted = sortedStudents.map((s, idx) => {
    // Percentile rank (using standard plotting position formula for robust quantile mapping)
    const percentile = (idx + 0.5) / N;
    
    // Get target mark from ideal normal percentile point
    const targetMark = Number(normalPercentilePoint(percentile, targetMean, targetStdDev).toFixed(1));
    const offset = Number((targetMark - s.mark).toFixed(1));

    return {
      id: s.id,
      name: s.name,
      originalMark: s.mark,
      targetMark,
      offset,
      originalIdx: s.originalIdx
    };
  });

  // Restore original ordering
  return adjusted.sort((a, b) => a.originalIdx - b.originalIdx);
}

/**
 * Solves for the exact uniform mark adjustment (+/- C) required to achieve a target pass percentage
 */
export function calculateTargetPassFailAdjustment(rawMarks, targetPassRate, passingThreshold = 35) {
  if (!rawMarks || rawMarks.length === 0) {
    return { adjustment: 0, resultingPassRate: 0, actualPassRate: 0, currentPassCount: 0, N: 0 };
  }
  
  const N = rawMarks.length;
  const currentPassCount = rawMarks.filter(m => m >= passingThreshold).length;
  const actualPassRate = Number(((currentPassCount / N) * 100).toFixed(1));

  let bestAdjustment = 0;
  let closestDiff = 100;
  let bestPassRate = 0;

  // Sweep offsets from -100 to +100 in 0.5 step sizes to find the closest fit
  for (let adj = -100; adj <= 100; adj += 0.5) {
    const adjMarks = rawMarks.map(m => Math.min(100, Math.max(0, Number((m + adj).toFixed(1)))));
    const passes = adjMarks.filter(m => m >= passingThreshold).length;
    const rate = (passes / N) * 100;
    const diff = Math.abs(rate - targetPassRate);

    if (diff < closestDiff || (diff === closestDiff && Math.abs(adj) < Math.abs(bestAdjustment))) {
      closestDiff = diff;
      bestAdjustment = adj;
      bestPassRate = Number(rate.toFixed(1));
    }
  }

  return {
    adjustment: Number(bestAdjustment.toFixed(1)),
    resultingPassRate: bestPassRate,
    actualPassRate,
    currentPassCount,
    N
  };
}


