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
