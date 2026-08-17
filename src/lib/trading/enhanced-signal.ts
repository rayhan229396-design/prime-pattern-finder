// src/lib/trading/enhanced-signal.ts

export interface IndicatorData {
  price: number;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  sma20: number;
  rsi: number;
  macdHistogram: number;
  volume: number;
  volumeSma20: number;
  atr: number;
  nearestResistance: number;
  nearestSupport: number;
  hasUpcomingNews: boolean;
}

export interface SignalAnalysisResult {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  marketRegime: 'Strong Trend' | 'Weak Trend' | 'Ranging' | 'High Volatility';
  confluenceScore: number;
  reasons: string[];
  warnings: string[];
  tradeAction: 'CALL' | 'PUT' | 'NO TRADE';
}

export function analyzeSignal(data: IndicatorData): SignalAnalysisResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // -------------------------------------------------------------
  // ১. আগের ট্র্যাকিং লজিক (Base Alignment)
  // -------------------------------------------------------------
  if (data.ema9 > data.ema21) {
    reasons.push("EMA 9/21 bullish alignment");
    score += 15;
  }
  if (data.ema21 > data.ema50) {
    reasons.push("EMA 21 above EMA 50");
    score += 15;
  }
  if (data.price > data.ema200) {
    reasons.push("Price above EMA 200");
    score += 15;
  }
  if (data.price > data.sma20) {
    reasons.push("Price above SMA 20");
    score += 10;
  }
  if (data.rsi > 50) {
    reasons.push("RSI momentum bullish");
    score += 15;
  }
  if (data.macdHistogram > 0) {
    reasons.push("MACD histogram positive");
    score += 15;
  }

  // -------------------------------------------------------------
  // ২. নতুন ফিল্টার ১: Volume Confirmations (ভলিউম চেক)
  // -------------------------------------------------------------
  if (data.volume > data.volumeSma20) {
    reasons.push("High trading volume supports trend");
    score += 15;
  } else {
    warnings.push("Low Volume: Breakout might be weak or fake");
  }

  // -------------------------------------------------------------
  // ৩. নতুন ফিল্টার ২: Support / Resistance Distance Check
  // -------------------------------------------------------------
  const distanceToResistance = ((data.nearestResistance - data.price) / data.price) * 100;
  if (distanceToResistance < 0.2) { // resistance-এর খুব কাছে (০.২% এর কম)
    warnings.push("Price is extremely close to Major Resistance");
    score -= 20; // স্কোর কমিয়ে দেওয়া হলো
  } else {
    reasons.push("Sufficient room to reach Resistance");
  }

  // -------------------------------------------------------------
  // ৪. নতুন ফিল্টার ৩: News Event Warning
  // -------------------------------------------------------------
  if (data.hasUpcomingNews) {
    warnings.push("HIGH IMPACT NEWS AHEAD: Market can be unpredictable");
    score -= 25;
  }

  // -------------------------------------------------------------
  // ৫. ট্রেন্ড ও অ্যাকশন ডিসিশন (Decision Logic)
  // -------------------------------------------------------------
  let marketRegime: SignalAnalysisResult['marketRegime'] = 'Weak Trend';
  if (score >= 80 && data.volume > data.volumeSma20) {
    marketRegime = 'Strong Trend';
  } else if (data.atr > data.price * 0.005) {
    marketRegime = 'High Volatility';
  }

  let tradeAction: SignalAnalysisResult['tradeAction'] = 'NO TRADE';
  if (score >= 70 && !data.hasUpcomingNews) {
    tradeAction = 'CALL';
  } else if (score <= 30 && !data.hasUpcomingNews) {
    tradeAction = 'PUT';
  }

  return {
    trend: score >= 50 ? 'BULLISH' : 'BEARISH',
    marketRegime,
    confluenceScore: Math.max(0, Math.min(100, score)), // 0 - 100 range
    reasons,
    warnings,
    tradeAction
  };
}
