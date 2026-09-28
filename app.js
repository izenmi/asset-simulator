/**
 * AssetForge - 資産形成＆FIRE詳細シミュレーター
 * Advanced Asset Accumulation & FIRE Simulation Engine
 */

// 最大シミュレーション期間の安全ハードリミット（メモリ枯渇・クラッシュ防止）
const MAX_SIMULATION_YEARS = 95; // 18歳〜110歳で最大93年

// 全パラメータの安全入力限界値（最小値・最大値・初期値）
const PARAM_LIMITS = {
  currentAge: { min: 18, max: 75, default: 30 },
  retireAge: { min: 20, max: 85, default: 50 },
  endAge: { min: 60, max: 110, default: 100 },
  currentAsset: { min: 0, max: 100000, default: 500 }, // 10億円
  monthlyInvestment: { min: 0, max: 1000, default: 10 }, // 1,000万円/月
  annualBonusInvestment: { min: 0, max: 3000, default: 30 }, // 3,000万円/年
  expectedReturn: { min: -20, max: 30, default: 5.0 }, // -20%〜30%
  monthlyLivingCost: { min: 1, max: 200, default: 20 }, // 200万円/月
  nisaPriority: { min: 0, max: 3600, default: 1800 }, // 3,600万円
  severanceAge: { min: 20, max: 85, default: 50 },
  severanceAmount: { min: 0, max: 10000, default: 1500 }, // 1億円
  severanceYears: { min: 0, max: 50, default: 28 },
  crashAge: { min: 18, max: 110, default: 45 },
  crashDropRate: { min: 5, max: 90, default: 35 },
  crashRecoveryYears: { min: 1, max: 20, default: 3 },
  sideFireMonthly: { min: 0, max: 100, default: 8 },
  sideFireEndAge: { min: 20, max: 110, default: 65 },
  pensionStartAge: { min: 60, max: 75, default: 65 },
  pensionMonthly: { min: 0, max: 50, default: 15 },
  inflationRate: { min: -5, max: 15, default: 1.5 },
  salaryGrowthRate: { min: -5, max: 15, default: 1.0 }
};

/**
 * 入力値を安全な許容範囲内にクランプ（丸め込み）する
 */
function clampParam(key, value) {
  const limit = PARAM_LIMITS[key];
  if (!limit) return value;
  let num = parseFloat(value);
  if (isNaN(num)) return limit.default;
  if (num < limit.min) return limit.min;
  if (num > limit.max) return limit.max;
  return num;
}

/**
 * 状態オブジェクト全体をサニタイズ（安全検証・クランプ）する
 */
function sanitizeState(s) {
  const safe = { ...s };
  for (const key of Object.keys(PARAM_LIMITS)) {
    if (safe[key] !== undefined) {
      safe[key] = clampParam(key, safe[key]);
    }
  }
  // 年齢の整合性チェック
  if (safe.retireAge <= safe.currentAge) {
    safe.retireAge = Math.min(PARAM_LIMITS.retireAge.max, safe.currentAge + 1);
  }
  if (safe.endAge <= safe.retireAge) {
    safe.endAge = Math.min(PARAM_LIMITS.endAge.max, safe.retireAge + 1);
    if (safe.retireAge >= safe.endAge) {
      safe.retireAge = safe.endAge - 1;
    }
  }
  return safe;
}

// 状態管理の初期値
const DEFAULT_STATE = {
  mode: 'advance', // 'standard' | 'advance'
  currentAge: 30,
  retireAge: 50,
  endAge: 100,
  currentAsset: 500, // 万円
  monthlyInvestment: 10, // 万円/月
  annualBonusInvestment: 30, // 万円/年
  expectedReturn: 5.0, // %
  monthlyLivingCost: 20, // 万円/月

  // 退職金
  enableSeverance: true,
  syncSeveranceWithRetire: true, // リタイア年齢から自動的に持ってくる
  severanceAge: 50,
  severanceAmount: 1500, // 万円
  severanceYears: 28, // 勤続年数 (50歳リタイア時: 22歳就職想定で28年)

  // 暴落予想
  enableCrash: true,
  crashAge: 45,
  crashDropRate: 35, // %
  crashRecoveryYears: 3,
  crashBehavior: 'continue', // 'continue' | 'buy-more' | 'panic-stop'

  // サイドFIRE
  enableSideFire: true,
  sideFireMonthly: 8, // 万円/月
  sideFireEndAge: 65,

  // 公的年金
  enablePension: true,
  pensionStartAge: 65,
  pensionMonthly: 15, // 万円/月 (65歳基準)

  // 税制・物価・昇給
  nisaPriority: 1800, // 万円
  inflationRate: 1.5, // %
  salaryGrowthRate: 1.0, // %

  // ライフイベント
  events: [
    { id: 'ev1', name: 'マイホーム購入（頭金）', age: 38, amount: -400 },
    { id: 'ev2', name: '子供の大学進学', age: 48, amount: -350 }
  ],

  // 表示設定
  chartView: 'nominal', // 'nominal' | 'real'
  chartTab: 'assets' // 'assets' | 'monte-carlo' | 'cashflow'
};

// プリセット集
const PRESETS = {
  'standard-fire': {
    currentAge: 30,
    retireAge: 50,
    endAge: 100,
    currentAsset: 600,
    monthlyInvestment: 15,
    annualBonusInvestment: 60,
    expectedReturn: 6.0,
    monthlyLivingCost: 22,
    enableSeverance: false,
    enableCrash: false,
    enableSideFire: false,
    enablePension: true,
    pensionStartAge: 65,
    pensionMonthly: 14,
    nisaPriority: 1800,
    inflationRate: 1.5,
    salaryGrowthRate: 1.5,
    events: []
  },
  'side-fire': {
    currentAge: 30,
    retireAge: 48,
    endAge: 100,
    currentAsset: 500,
    monthlyInvestment: 12,
    annualBonusInvestment: 30,
    expectedReturn: 5.5,
    monthlyLivingCost: 20,
    enableSeverance: true,
    severanceAge: 48,
    severanceAmount: 500,
    severanceYears: 25,
    enableCrash: true,
    crashAge: 42,
    crashDropRate: 30,
    crashRecoveryYears: 3,
    crashBehavior: 'continue',
    enableSideFire: true,
    sideFireMonthly: 9,
    sideFireEndAge: 68,
    enablePension: true,
    pensionStartAge: 65,
    pensionMonthly: 14,
    nisaPriority: 1800,
    inflationRate: 1.5,
    salaryGrowthRate: 1.0,
    events: [
      { id: 'ev1', name: '独立・開業一時費用', age: 48, amount: -150 }
    ]
  },
  'steady-koumuin': {
    currentAge: 32,
    retireAge: 60,
    endAge: 100,
    currentAsset: 700,
    monthlyInvestment: 8,
    annualBonusInvestment: 50,
    expectedReturn: 4.5,
    monthlyLivingCost: 24,
    enableSeverance: true,
    severanceAge: 60,
    severanceAmount: 2200,
    severanceYears: 38,
    enableCrash: false,
    enableSideFire: false,
    enablePension: true,
    pensionStartAge: 65,
    pensionMonthly: 19,
    nisaPriority: 1800,
    inflationRate: 1.0,
    salaryGrowthRate: 1.0,
    events: [
      { id: 'ev1', name: '住宅ローン完済', age: 55, amount: -500 }
    ]
  },
  'crash-stress-test': {
    currentAge: 35,
    retireAge: 52,
    endAge: 100,
    currentAsset: 800,
    monthlyInvestment: 12,
    annualBonusInvestment: 40,
    expectedReturn: 5.5,
    monthlyLivingCost: 22,
    enableSeverance: true,
    severanceAge: 52,
    severanceAmount: 1000,
    severanceYears: 28,
    enableCrash: true,
    crashAge: 51,
    crashDropRate: 45,
    crashRecoveryYears: 5,
    crashBehavior: 'continue',
    enableSideFire: true,
    sideFireMonthly: 8,
    sideFireEndAge: 65,
    enablePension: true,
    pensionStartAge: 65,
    pensionMonthly: 15,
    nisaPriority: 1800,
    inflationRate: 2.0,
    salaryGrowthRate: 0.5,
    events: []
  },
  'conservative': {
    currentAge: 30,
    retireAge: 60,
    endAge: 100,
    currentAsset: 400,
    monthlyInvestment: 6,
    annualBonusInvestment: 20,
    expectedReturn: 3.5,
    monthlyLivingCost: 18,
    enableSeverance: true,
    severanceAge: 60,
    severanceAmount: 1200,
    severanceYears: 35,
    enableCrash: false,
    enableSideFire: false,
    enablePension: true,
    pensionStartAge: 68,
    pensionMonthly: 15,
    nisaPriority: 1800,
    inflationRate: 1.0,
    salaryGrowthRate: 0.5,
    events: []
  }
};

// アプリケーション状態
let state = { ...DEFAULT_STATE };
let chartInstance = null;
let currentSimulationResult = null;
let savedPlans = []; // ユーザーが名前を付けて保存したプラン一覧

// ==========================================
// 1. 税金・年金・計算ロジック
// ==========================================

/**
 * 日本の退職所得控除および手取り額を計算
 */
function calculateSeveranceNet(amountMan, years) {
  if (amountMan <= 0) return 0;
  const amountYen = amountMan * 10000;
  
  // 控除額の計算
  let deductionYen = 0;
  if (years <= 20) {
    deductionYen = Math.max(800000, 400000 * years);
  } else {
    deductionYen = 8000000 + 700000 * (years - 20);
  }

  const taxableYen = Math.max(0, (amountYen - deductionYen) * 0.5);
  if (taxableYen === 0) {
    return amountMan; // 控除内は全額非課税
  }

  // 所得税概算
  let taxYen = 0;
  if (taxableYen <= 1950000) taxYen = taxableYen * 0.05;
  else if (taxableYen <= 3300000) taxYen = taxableYen * 0.10 - 97500;
  else if (taxableYen <= 6950000) taxYen = taxableYen * 0.20 - 427500;
  else if (taxableYen <= 8999000) taxYen = taxableYen * 0.23 - 636000;
  else if (taxableYen <= 17999000) taxYen = taxableYen * 0.33 - 1536000;
  else taxYen = taxableYen * 0.40 - 2796000;

  // 復興特別所得税 (2.1%) + 住民税 (10%)
  const totalTaxYen = taxYen * 1.021 + taxableYen * 0.10;
  const netMan = (amountYen - totalTaxYen) / 10000;
  return Math.round(netMan * 10) / 10;
}

/**
 * 年金の繰り上げ・繰り下げ調整倍率を算出
 */
function getPensionMultiplier(startAge) {
  if (startAge === 65) return 1.0;
  if (startAge < 65) {
    // 繰上げ: 1ヶ月あたり-0.4% (年-4.8%)
    const monthsEarly = (65 - startAge) * 12;
    return Math.max(0.76, 1.0 - monthsEarly * 0.004);
  } else {
    // 繰下げ: 1ヶ月あたり+0.7% (年+8.4%)
    const monthsLate = (startAge - 65) * 12;
    return Math.min(1.84, 1.0 + monthsLate * 0.007);
  }
}

/**
 * 単一年のシミュレーション実行（メインエンジン）
 */
function runSimulation(s) {
  const safeCurrentAge = Math.max(18, Math.min(PARAM_LIMITS.currentAge.max, Math.floor(s.currentAge || 30)));
  const safeEndAge = Math.max(safeCurrentAge + 1, Math.min(PARAM_LIMITS.endAge.max, Math.floor(s.endAge || 100)));
  const yearsCount = Math.min(MAX_SIMULATION_YEARS, Math.max(1, safeEndAge - safeCurrentAge + 1));
  const rows = [];

  let currentTotalAsset = s.currentAsset;
  let cumulativePrincipal = s.currentAsset; // 累計元本
  let nisaPrincipal = Math.min(s.currentAsset, s.nisaPriority); // NISA枠利用額
  let taxablePrincipal = Math.max(0, s.currentAsset - s.nisaPriority);
  let isDepleted = false;
  let depletedAge = null;
  let fireTargetReachedAge = null;

  // 4%ルールに基づくFIRE目標額 (年生活費 × 25倍)
  const annualLivingCost = s.monthlyLivingCost * 12;
  const targetFireAsset = annualLivingCost * 25;

  const pensionNetMultiplier = getPensionMultiplier(s.pensionStartAge);
  const adjustedPensionMonthly = s.pensionMonthly * pensionNetMultiplier;
  const annualNetPension = adjustedPensionMonthly * 12 * 0.85; // 社保・税引き手取り概算

  for (let i = 0; i < yearsCount; i++) {
    const age = safeCurrentAge + i;
    const isRetired = (age >= s.retireAge);
    const eventsThisYear = s.events.filter(e => e.age === age);

    let annualIncome = 0;
    let annualExpense = 0;
    let eventNote = [];

    // --- 1. 収入の算出 ---
    if (!isRetired) {
      // 労働収入からの積立額 (年次昇給ステップアップ考慮)
      const stepFactor = Math.pow(1 + s.salaryGrowthRate / 100, i);
      let yearContribution = (s.monthlyInvestment * 12 + s.annualBonusInvestment) * stepFactor;

      // 暴落時の積立行動制御
      if (s.enableCrash && s.crashBehavior === 'panic-stop' && age >= s.crashAge && age < s.crashAge + s.crashRecoveryYears) {
        yearContribution = 0;
        eventNote.push('😨 暴落パニック積立停止');
      } else if (s.enableCrash && s.crashBehavior === 'buy-more' && age === s.crashAge) {
        yearContribution *= 1.5;
        eventNote.push('🚀 暴落スポット買い増し');
      }

      annualIncome += yearContribution;
    } else {
      // リタイア後: サイドFIRE副収入
      if (s.enableSideFire && age <= s.sideFireEndAge) {
        const sideIncomeNet = s.sideFireMonthly * 12 * 0.8; // 税引後概算
        annualIncome += sideIncomeNet;
        eventNote.push(`☕ サイドFIRE副業 (${s.sideFireMonthly}万/月)`);
      }
    }

    // 退職金
    if (s.enableSeverance && age === s.severanceAge) {
      const netSeverance = calculateSeveranceNet(s.severanceAmount, s.severanceYears);
      annualIncome += netSeverance;
      eventNote.push(`💼 退職金手取り (+${Math.round(netSeverance)}万円)`);
    }

    // 公的年金
    if (s.enablePension && age >= s.pensionStartAge) {
      annualIncome += annualNetPension;
      if (age === s.pensionStartAge) {
        eventNote.push(`🛡️ 年金受給開始 (${Math.round(adjustedPensionMonthly * 10) / 10}万/月)`);
      }
    }

    // --- 2. 支出の算出 ---
    if (isRetired) {
      annualExpense += annualLivingCost;
    }

    // ライフイベント
    for (const ev of eventsThisYear) {
      if (ev.amount < 0) {
        annualExpense += Math.abs(ev.amount);
        eventNote.push(`⚠️ ${ev.name} (${ev.amount}万)`);
      } else {
        annualIncome += ev.amount;
        eventNote.push(`🎁 ${ev.name} (+${ev.amount}万)`);
      }
    }

    // --- 3. 利回りの決定（暴落考慮） ---
    let effectiveReturnRate = s.expectedReturn;
    let isCrashYear = false;

    if (s.enableCrash) {
      if (age === s.crashAge) {
        effectiveReturnRate = -s.crashDropRate;
        isCrashYear = true;
        eventNote.push(`⚡ 市場暴落直撃 (-${s.crashDropRate}%)`);
      } else if (age > s.crashAge && age < s.crashAge + s.crashRecoveryYears) {
        const recoveryBounce = (s.crashDropRate / s.crashRecoveryYears) * 0.6;
        effectiveReturnRate = s.expectedReturn + recoveryBounce;
        eventNote.push(`📈 暴落からの回復局面 (+${Math.round(effectiveReturnRate * 10) / 10}%)`);
      }
    }

    // --- 4. 資産の更新と複利運用計算 ---
    const netCashFlow = annualIncome - annualExpense;
    let startAsset = currentTotalAsset;
    let investmentGain = 0;

    if (!isDepleted && startAsset > 0) {
      investmentGain = startAsset * (effectiveReturnRate / 100);
      currentTotalAsset = startAsset + investmentGain + netCashFlow;

      if (!isRetired) {
        cumulativePrincipal += annualIncome;
        if (nisaPrincipal < s.nisaPriority) {
          const nisaAdd = Math.min(annualIncome, s.nisaPriority - nisaPrincipal);
          nisaPrincipal += nisaAdd;
          taxablePrincipal += (annualIncome - nisaAdd);
        } else {
          taxablePrincipal += annualIncome;
        }
      } else {
        if (netCashFlow < 0) {
          const withdrawAmount = Math.abs(netCashFlow);
          if (taxablePrincipal > 0 && currentTotalAsset > cumulativePrincipal) {
            const gainRatio = Math.max(0, (currentTotalAsset - cumulativePrincipal) / currentTotalAsset);
            const taxableGainPortion = withdrawAmount * gainRatio * 0.5;
            const tax = taxableGainPortion * 0.20315;
            currentTotalAsset -= tax;
          }
        }
      }

      if (currentTotalAsset <= 0) {
        currentTotalAsset = 0;
        isDepleted = true;
        depletedAge = age;
        eventNote.push('🛑 資産枯渇！');
      }
    } else {
      currentTotalAsset = 0;
      investmentGain = 0;
    }

    if (!fireTargetReachedAge && currentTotalAsset >= targetFireAsset) {
      fireTargetReachedAge = age;
    }

    const inflationDiscount = Math.pow(1 + s.inflationRate / 100, i);
    const realAsset = currentTotalAsset / inflationDiscount;

    rows.push({
      yearIndex: i,
      age,
      isRetired,
      annualIncome: Math.round(annualIncome * 10) / 10,
      annualExpense: Math.round(annualExpense * 10) / 10,
      netCashFlow: Math.round(netCashFlow * 10) / 10,
      returnRate: effectiveReturnRate,
      investmentGain: Math.round(investmentGain * 10) / 10,
      totalAsset: Math.round(currentTotalAsset * 10) / 10,
      realAsset: Math.round(realAsset * 10) / 10,
      cumulativePrincipal: Math.round(cumulativePrincipal * 10) / 10,
      isCrashYear,
      eventNote: eventNote.join(' / ')
    });
  }

  const retireRow = rows.find(r => r.age === s.retireAge) || rows[0] || { totalAsset: 0, realAsset: 0, cumulativePrincipal: 0 };
  const endRow = rows[rows.length - 1] || { totalAsset: 0, realAsset: 0 };

  return {
    rows,
    retireAsset: retireRow.totalAsset,
    retireRealAsset: retireRow.realAsset,
    retirePrincipal: retireRow.cumulativePrincipal,
    endAsset: endRow.totalAsset,
    endRealAsset: endRow.realAsset,
    isDepleted,
    depletedAge,
    fireTargetReachedAge,
    targetFireAsset: Math.round(targetFireAsset)
  };
}

/**
 * モンテカルロ・シミュレーション（1,000回試行）
 */
function runMonteCarloSimulation(s, trials = 1000) {
  const safeCurrentAge = Math.max(18, Math.min(PARAM_LIMITS.currentAge.max, Math.floor(s.currentAge || 30)));
  const safeEndAge = Math.max(safeCurrentAge + 1, Math.min(PARAM_LIMITS.endAge.max, Math.floor(s.endAge || 100)));
  const yearsCount = Math.min(MAX_SIMULATION_YEARS, Math.max(1, safeEndAge - safeCurrentAge + 1));
  const meanReturn = s.expectedReturn / 100;
  const volatility = 0.15;

  const yearlyBalances = Array.from({ length: yearsCount }, () => []);
  let failedTrialsCount = 0;

  for (let t = 0; t < trials; t++) {
    let balance = s.currentAsset;
    let trialDepleted = false;

    for (let i = 0; i < yearsCount; i++) {
      const age = safeCurrentAge + i;
      const isRetired = (age >= s.retireAge);

      let income = 0;
      let expense = 0;

      if (!isRetired) {
        const stepFactor = Math.pow(1 + s.salaryGrowthRate / 100, i);
        income += (s.monthlyInvestment * 12 + s.annualBonusInvestment) * stepFactor;
      } else {
        expense += s.monthlyLivingCost * 12;
        if (s.enableSideFire && age <= s.sideFireEndAge) {
          income += s.sideFireMonthly * 12 * 0.8;
        }
      }

      if (s.enableSeverance && age === s.severanceAge) {
        income += calculateSeveranceNet(s.severanceAmount, s.severanceYears);
      }

      if (s.enablePension && age >= s.pensionStartAge) {
        const pensionMultiplier = getPensionMultiplier(s.pensionStartAge);
        income += s.pensionMonthly * pensionMultiplier * 12 * 0.85;
      }

      const evs = s.events.filter(e => e.age === age);
      for (const ev of evs) {
        if (ev.amount < 0) expense += Math.abs(ev.amount);
        else income += ev.amount;
      }

      const u1 = Math.max(1e-10, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const randomReturn = meanReturn + volatility * z;

      if (balance > 0) {
        balance = balance * (1 + randomReturn) + (income - expense);
        if (balance <= 0) {
          balance = 0;
          trialDepleted = true;
        }
      } else {
        balance = 0;
      }

      yearlyBalances[i].push(balance);
    }

    if (trialDepleted) {
      failedTrialsCount++;
    }
  }

  const percentiles = {
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: []
  };

  for (let i = 0; i < yearsCount; i++) {
    const sorted = yearlyBalances[i].sort((a, b) => a - b);
    percentiles.p10.push(Math.round(sorted[Math.floor(trials * 0.1)] * 10) / 10);
    percentiles.p25.push(Math.round(sorted[Math.floor(trials * 0.25)] * 10) / 10);
    percentiles.p50.push(Math.round(sorted[Math.floor(trials * 0.5)] * 10) / 10);
    percentiles.p75.push(Math.round(sorted[Math.floor(trials * 0.75)] * 10) / 10);
    percentiles.p90.push(Math.round(sorted[Math.floor(trials * 0.9)] * 10) / 10);
  }

  const successRate = Math.round(((trials - failedTrialsCount) / trials) * 100);
  return {
    successRate,
    percentiles
  };
}

// ==========================================
// 2. UI連動・イベントハンドリング
// ==========================================

function bindSync(sliderId, numberId, valSpanId, formatFn, stateKey) {
  const slider = document.getElementById(sliderId);
  const number = document.getElementById(numberId);
  const valSpan = valSpanId ? document.getElementById(valSpanId) : null;
  const limit = PARAM_LIMITS[stateKey];

  if (!slider || !number) return;

  const update = (newVal, source) => {
    let num = parseFloat(newVal);
    if (isNaN(num)) num = limit ? limit.default : 0;
    
    // 上限ガード: 入力中に上限を超えたら即時クランプしてメモリ大量消費・ループ暴走を防止
    if (limit && num > limit.max) {
      num = limit.max;
      if (source === 'number') number.value = limit.max;
    }

    // stateにセットする値は安全範囲にクランプ
    const safeVal = limit ? clampParam(stateKey, num) : num;
    state[stateKey] = safeVal;

    if (source !== 'slider') slider.value = safeVal;

    if (source === 'blur') {
      if (limit && num < limit.min) {
        number.value = limit.min;
        state[stateKey] = limit.min;
      } else {
        number.value = state[stateKey];
      }
    } else if (source !== 'number') {
      number.value = safeVal;
    }

    if (valSpan && formatFn) valSpan.textContent = formatFn(state[stateKey]);

    onStateChange();
  };

  slider.addEventListener('input', (e) => update(e.target.value, 'slider'));
  number.addEventListener('input', (e) => update(e.target.value, 'number'));
  number.addEventListener('change', (e) => update(e.target.value, 'blur'));
  number.addEventListener('blur', (e) => update(e.target.value, 'blur'));
}

function initApp() {
  if (window.lucide) {
    lucide.createIcons();
  }

  loadSavedState();

  const btnModeStandard = document.getElementById('btnModeStandard');
  const btnModeAdvance = document.getElementById('btnModeAdvance');
  btnModeStandard.addEventListener('click', () => setMode('standard'));
  btnModeAdvance.addEventListener('click', () => setMode('advance'));

  const btnThemeToggle = document.getElementById('btnThemeToggle');
  btnThemeToggle.addEventListener('click', toggleTheme);

  const presetSelect = document.getElementById('presetSelect');
  presetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    if (val.startsWith('user_plan_')) {
      const planId = val.replace('user_plan_', '');
      loadSavedPlan(planId);
    } else {
      const p = PRESETS[val];
      if (p) {
        applyPreset(p);
        showToast(`プリセット「${presetSelect.options[presetSelect.selectedIndex].text}」を適用しました`);
      }
    }
  });

  setupPlanManagementModal();

  document.getElementById('btnShareUrl').addEventListener('click', shareUrl);
  document.getElementById('btnExportCsv').addEventListener('click', exportCsv);

  document.getElementById('btnViewNominal').addEventListener('click', () => setChartView('nominal'));
  document.getElementById('btnViewReal').addEventListener('click', () => setChartView('real'));

  document.getElementById('tabChartAssets').addEventListener('click', () => setChartTab('assets'));
  document.getElementById('tabChartMonteCarlo').addEventListener('click', () => setChartTab('monte-carlo'));
  document.getElementById('tabChartCashflow').addEventListener('click', () => setChartTab('cashflow'));

  bindSync('currentAge', 'currentAgeNum', 'currentAgeVal', (v) => `${v}歳`, 'currentAge');
  bindSync('retireAge', 'retireAgeNum', 'retireAgeVal', (v) => `${v}歳`, 'retireAge');
  bindSync('endAge', 'endAgeNum', 'endAgeVal', (v) => `${v}歳`, 'endAge');
  bindSync('currentAsset', 'currentAssetNum', 'currentAssetVal', (v) => formatMan(v), 'currentAsset');
  bindSync('monthlyInvestment', 'monthlyInvestmentNum', 'monthlyInvestmentVal', (v) => `${v}万円/月`, 'monthlyInvestment');
  bindSync('annualBonusInvestment', 'annualBonusInvestmentNum', 'annualBonusInvestmentVal', (v) => `${v}万円/年`, 'annualBonusInvestment');
  bindSync('expectedReturn', 'expectedReturnNum', 'expectedReturnVal', (v) => `${v.toFixed(1)}%`, 'expectedReturn');
  bindSync('monthlyLivingCost', 'monthlyLivingCostNum', 'monthlyLivingCostVal', (v) => `${v}万円/月`, 'monthlyLivingCost');

  bindSimpleInput('enableSeverance', 'checked', 'enableSeverance');
  
  const chkSyncSev = document.getElementById('syncSeveranceWithRetire');
  if (chkSyncSev) {
    chkSyncSev.addEventListener('change', () => {
      state.syncSeveranceWithRetire = chkSyncSev.checked;
      if (state.syncSeveranceWithRetire) {
        state.severanceAge = state.retireAge;
      }
      onStateChange();
    });
  }

  const inputSevAge = document.getElementById('severanceAge');
  if (inputSevAge) {
    const limitSev = PARAM_LIMITS.severanceAge;
    inputSevAge.addEventListener('input', () => {
      let val = parseFloat(inputSevAge.value);
      if (!isNaN(val)) {
        if (limitSev && val > limitSev.max) {
          val = limitSev.max;
          inputSevAge.value = limitSev.max;
        }
        state.severanceAge = clampParam('severanceAge', val);
        // 手動で編集されたら連動をOFFにする
        if (state.syncSeveranceWithRetire && state.severanceAge !== state.retireAge) {
          state.syncSeveranceWithRetire = false;
          if (chkSyncSev) chkSyncSev.checked = false;
        }
        onStateChange();
      }
    });
    inputSevAge.addEventListener('blur', () => {
      let val = parseFloat(inputSevAge.value);
      if (isNaN(val) || (limitSev && val < limitSev.min)) {
        val = limitSev ? limitSev.min : 50;
        inputSevAge.value = val;
        state.severanceAge = val;
        onStateChange();
      }
    });
  }

  bindSimpleInput('severanceAmount', 'value', 'severanceAmount', true);
  bindSimpleInput('severanceYears', 'value', 'severanceYears', true);

  bindSimpleInput('enableCrash', 'checked', 'enableCrash');
  bindSimpleInput('crashAge', 'value', 'crashAge', true);
  bindSimpleInput('crashDropRate', 'value', 'crashDropRate', true);
  bindSimpleInput('crashRecoveryYears', 'value', 'crashRecoveryYears', true);
  bindSimpleInput('crashBehavior', 'value', 'crashBehavior');

  bindSimpleInput('enableSideFire', 'checked', 'enableSideFire');
  bindSimpleInput('sideFireMonthly', 'value', 'sideFireMonthly', true);
  bindSimpleInput('sideFireEndAge', 'value', 'sideFireEndAge', true);

  bindSimpleInput('enablePension', 'checked', 'enablePension');
  bindSimpleInput('pensionStartAge', 'value', 'pensionStartAge', true);
  bindSimpleInput('pensionMonthly', 'value', 'pensionMonthly', true);

  bindSimpleInput('nisaPriority', 'value', 'nisaPriority', true);
  bindSimpleInput('inflationRate', 'value', 'inflationRate', true);
  bindSimpleInput('salaryGrowthRate', 'value', 'salaryGrowthRate', true);

  setupEventModal();
  syncControlsToState();
  updateSimulation();
}

function bindSimpleInput(elementId, prop, stateKey, isNumber = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const limit = PARAM_LIMITS[stateKey];

  const handleUpdate = (isFinal = false) => {
    let val = el[prop];
    if (isNumber) {
      let num = parseFloat(val);
      if (isNaN(num)) num = limit ? limit.default : 0;
      if (limit) {
        if (num > limit.max) {
          num = limit.max;
          el.value = limit.max;
        } else if (isFinal && num < limit.min) {
          num = limit.min;
          el.value = limit.min;
        }
      }
      val = limit ? clampParam(stateKey, num) : num;
    }
    state[stateKey] = val;
    onStateChange();
  };

  el.addEventListener('change', () => handleUpdate(true));
  if (isNumber) {
    el.addEventListener('input', (e) => {
      let num = parseFloat(e.target.value);
      if (limit && !isNaN(num) && num > limit.max) {
        e.target.value = limit.max;
        handleUpdate(false);
      }
    });
    el.addEventListener('blur', () => handleUpdate(true));
  }
}

function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('mode-standard', mode === 'standard');

  const btnStd = document.getElementById('btnModeStandard');
  const btnAdv = document.getElementById('btnModeAdvance');

  if (mode === 'standard') {
    btnStd.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white';
    btnAdv.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center space-x-1';
  } else {
    btnAdv.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm bg-brand-600 text-white flex items-center space-x-1';
    btnStd.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  }

  onStateChange();
}

function setChartView(view) {
  state.chartView = view;
  const btnNom = document.getElementById('btnViewNominal');
  const btnReal = document.getElementById('btnViewReal');
  const badge = document.getElementById('chartSubtitleBadge');

  if (view === 'nominal') {
    btnNom.className = 'px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white';
    btnReal.className = 'px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    badge.textContent = '名目金額 (円)';
  } else {
    btnReal.className = 'px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white';
    btnNom.className = 'px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    badge.textContent = `実質購買力 (現在価値換算・インフレ${state.inflationRate}%)`;
  }

  renderChart();
}

function setChartTab(tab) {
  state.chartTab = tab;
  const tabs = ['assets', 'monte-carlo', 'cashflow'];
  const tabButtons = {
    'assets': document.getElementById('tabChartAssets'),
    'monte-carlo': document.getElementById('tabChartMonteCarlo'),
    'cashflow': document.getElementById('tabChartCashflow')
  };

  tabs.forEach(t => {
    const btn = tabButtons[t];
    if (t === tab) {
      btn.className = 'px-2.5 py-1 rounded-md bg-brand-500 text-white shadow-sm font-semibold';
    } else {
      btn.className = 'px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    }
  });

  renderChart();
}

function onStateChange() {
  // 1. 各年齢を安全上限・下限にクランプ
  state.currentAge = clampParam('currentAge', state.currentAge);
  state.retireAge = clampParam('retireAge', state.retireAge);
  state.endAge = clampParam('endAge', state.endAge);

  // 2. 年齢順序の整合性ガード（ただし上限を超えない）
  if (state.retireAge <= state.currentAge) {
    state.retireAge = Math.min(PARAM_LIMITS.retireAge.max, state.currentAge + 1);
  }
  if (state.endAge <= state.retireAge) {
    state.endAge = Math.min(PARAM_LIMITS.endAge.max, state.retireAge + 1);
    if (state.retireAge >= state.endAge) {
      state.retireAge = state.endAge - 1;
    }
  }

  // UI入力欄との確実な同期
  const rEl = document.getElementById('retireAge');
  const rnEl = document.getElementById('retireAgeNum');
  const rvEl = document.getElementById('retireAgeVal');
  if (rEl) rEl.value = state.retireAge;
  if (rnEl) rnEl.value = state.retireAge;
  if (rvEl) rvEl.textContent = `${state.retireAge}歳`;

  const eEl = document.getElementById('endAge');
  const enEl = document.getElementById('endAgeNum');
  const evEl = document.getElementById('endAgeVal');
  if (eEl) eEl.value = state.endAge;
  if (enEl) enEl.value = state.endAge;
  if (evEl) evEl.textContent = `${state.endAge}歳`;

  const cEl = document.getElementById('currentAge');
  const cnEl = document.getElementById('currentAgeNum');
  const cvEl = document.getElementById('currentAgeVal');
  if (cEl) cEl.value = state.currentAge;
  if (cnEl) cnEl.value = state.currentAge;
  if (cvEl) cvEl.textContent = `${state.currentAge}歳`;

  // 退職金受取年齢をリタイア年齢から自動的に持ってくる
  const sevAgeEl = document.getElementById('severanceAge');
  const hintEl = document.getElementById('severanceSyncHint');
  const chkSyncSev = document.getElementById('syncSeveranceWithRetire');

  if (state.syncSeveranceWithRetire !== false) {
    state.severanceAge = state.retireAge;
    if (sevAgeEl) {
      sevAgeEl.value = state.severanceAge;
    }
    if (chkSyncSev) {
      chkSyncSev.checked = true;
    }
    if (hintEl) {
      hintEl.textContent = `リタイア年齢 (${state.severanceAge}歳) で自動受給`;
      hintEl.className = 'text-[10px] text-brand-600 dark:text-brand-400 font-medium';
    }
  } else {
    if (chkSyncSev) {
      chkSyncSev.checked = false;
    }
    if (hintEl) {
      hintEl.textContent = `手動指定中 (${state.severanceAge}歳受給)`;
      hintEl.className = 'text-[10px] text-slate-400';
    }
  }

  const netSev = calculateSeveranceNet(state.severanceAmount, state.severanceYears);
  document.getElementById('severanceNetVal').textContent = `約${Math.round(netSev).toLocaleString()}万円`;

  const pMult = getPensionMultiplier(state.pensionStartAge);
  const pDiff = Math.round((pMult - 1.0) * 100);
  const pSign = pDiff > 0 ? `+${pDiff}%` : pDiff < 0 ? `${pDiff}%` : '±0%';
  document.getElementById('pensionAdjustmentLabel').textContent = `${Math.round(pMult * 100)}%受給 (${pSign})`;

  updateSimulation();
  saveStateToLocal();
}

function updateSimulation() {
  const result = runSimulation(state);
  const monteCarlo = runMonteCarloSimulation(state);
  currentSimulationResult = { ...result, monteCarlo };

  document.getElementById('kpiRetireAgeLabel').textContent = `リタイア時資産 (${state.retireAge}歳)`;
  document.getElementById('kpiRetireAssets').textContent = formatMan(result.retireAsset);
  
  const gainRatio = result.retirePrincipal > 0 
    ? Math.round(((result.retireAsset - result.retirePrincipal) / result.retirePrincipal) * 100) 
    : 0;
  const gainSign = gainRatio >= 0 ? `+${gainRatio}%` : `${gainRatio}%`;
  document.getElementById('kpiRetireGain').textContent = gainSign;

  document.getElementById('kpiEndAgeLabel').textContent = `人生終了時資産 (${state.endAge}歳)`;
  document.getElementById('kpiEndAssets').textContent = formatMan(result.endAsset);
  document.getElementById('kpiRealEndAssets').textContent = formatMan(result.endRealAsset);

  const isFirePossible = (result.retireAsset >= result.targetFireAsset || result.fireTargetReachedAge !== null);
  const kpiFireStatus = document.getElementById('kpiFireStatus');
  const kpiFireSub = document.getElementById('kpiFireSub');
  const kpiFireBadgeIcon = document.getElementById('kpiFireBadgeIcon');

  if (result.fireTargetReachedAge && result.fireTargetReachedAge <= state.retireAge) {
    kpiFireStatus.innerHTML = `<span class="text-brand-600 dark:text-brand-400 font-bold">${result.fireTargetReachedAge}歳でFIRE達成可</span>`;
    kpiFireSub.innerHTML = `目標4%資産 (${formatMan(result.targetFireAsset)}) 達成`;
    kpiFireBadgeIcon.className = 'p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400';
  } else if (!result.isDepleted && result.endAsset > 0) {
    kpiFireStatus.innerHTML = `<span class="text-brand-600 dark:text-brand-400 font-bold">リタイア安泰</span>`;
    kpiFireSub.innerHTML = `必要目標: ${formatMan(result.targetFireAsset)}`;
    kpiFireBadgeIcon.className = 'p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400';
  } else {
    kpiFireStatus.innerHTML = `<span class="text-rose-500 font-bold">${result.depletedAge}歳で枯渇恐れ</span>`;
    kpiFireSub.innerHTML = `目標不足: 毎月+${Math.round((result.targetFireAsset - result.retireAsset) / ((state.retireAge - state.currentAge) * 12))}万推奨`;
    kpiFireBadgeIcon.className = 'p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-rose-500';
  }

  document.getElementById('kpiSuccessRate').textContent = `${monteCarlo.successRate}%`;
  const kpiDepletionAge = document.getElementById('kpiDepletionAge');
  if (result.isDepleted) {
    kpiDepletionAge.innerHTML = `資産寿命: <span class="font-bold text-rose-500">${result.depletedAge}歳で尽きる</span>`;
  } else {
    kpiDepletionAge.innerHTML = `資産寿命: <span class="font-bold text-brand-600 dark:text-brand-400">生涯安泰 (${state.endAge}歳+)</span>`;
  }

  renderAdvice(result, monteCarlo);
  renderChart();
  renderTable(result.rows);
  renderEventList();
}

function renderAdvice(result, mc) {
  const container = document.getElementById('simulationAdviceContent');
  const notes = [];

  if (result.retireAsset >= result.targetFireAsset) {
    notes.push(`🎉 <strong>4%ルールクリア</strong>: 想定生活費（年${state.monthlyLivingCost * 12}万円）に対して必要な4%安全資産${formatMan(result.targetFireAsset)}を${state.retireAge}歳時点で上回っています。`);
  } else {
    notes.push(`💡 <strong>取り崩し計画</strong>: リタイア時の資産は${formatMan(result.retireAsset)}です。公的年金（月${state.pensionMonthly}万）やサイドFIRE副収入があるため、運用と組み合わせることでカバー可能です。`);
  }

  if (state.enableCrash) {
    notes.push(`⚡ <strong>市場暴落ショック（${state.crashAge}歳時に-${state.crashDropRate}%）</strong>: ${state.crashRecoveryYears}年間の低迷を経てリカバリーするシナリオです。暴落時も焦らず積立継続（ドルコスト平均法）することで、回復期の反発益を享受できます。`);
  }

  if (state.enableSideFire && state.sideFireMonthly > 0) {
    const totalSideIncome = state.sideFireMonthly * 12 * Math.max(0, state.sideFireEndAge - state.retireAge);
    notes.push(`☕ <strong>サイドFIRE効果</strong>: リタイア〜${state.sideFireEndAge}歳までに月${state.sideFireMonthly}万円の副業収入を得ることで、累計約<strong>${formatMan(totalSideIncome)}</strong>の資産取り崩しを回避できます。`);
  }

  notes.push(`🎲 <strong>不確実性（モンテカルロ1,000回）</strong>: 株式市場のボラティリティ（年率標準偏差15%）を考慮した資産完走成功率は<strong>${mc.successRate}%</strong>です。`);

  container.innerHTML = notes.map(n => `<p>${n}</p>`).join('');
}

function renderChart() {
  if (!currentSimulationResult) return;
  const ctx = document.getElementById('mainChart').getContext('2d');
  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const rows = currentSimulationResult.rows;
  const labels = rows.map(r => `${r.age}歳`);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const isReal = (state.chartView === 'real');

  if (state.chartTab === 'assets') {
    const assetData = rows.map(r => isReal ? r.realAsset : r.totalAsset);
    const principalData = rows.map(r => r.cumulativePrincipal);

    const pointRadii = rows.map(r => r.isCrashYear ? 7 : 0);
    const pointBackgrounds = rows.map(r => r.isCrashYear ? '#ef4444' : '#10b981');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: isReal ? '実質総資産 (物価調整)' : '名目資産総額',
            data: assetData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.25,
            borderWidth: 2.5,
            pointRadius: pointRadii,
            pointBackgroundColor: pointBackgrounds,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: '累計積立元本',
            data: principalData,
            borderColor: isDark ? '#64748b' : '#94a3b8',
            borderDash: [5, 4],
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatMan(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxTicksLimit: 12 }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (v) => formatMan(v)
            }
          }
        }
      }
    });

  } else if (state.chartTab === 'monte-carlo') {
    const mc = currentSimulationResult.monteCarlo.percentiles;

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '上位10% (好調シナリオ)',
            data: mc.p90,
            borderColor: 'rgba(99, 102, 241, 0.4)',
            backgroundColor: 'transparent',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: '上位25% (25-75%ゾーン)',
            data: mc.p75,
            borderColor: 'rgba(99, 102, 241, 0.6)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            fill: '+1',
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: '中央値 (50%タイル)',
            data: mc.p50,
            borderColor: '#6366f1',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0
          },
          {
            label: '下位25% (保守ゾーン)',
            data: mc.p25,
            borderColor: 'rgba(99, 102, 241, 0.6)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            fill: '+1',
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: '下位10% (最悪シナリオ)',
            data: mc.p10,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatMan(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxTicksLimit: 12 }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (v) => formatMan(v)
            }
          }
        }
      }
    });

  } else if (state.chartTab === 'cashflow') {
    const incomeData = rows.map(r => r.annualIncome);
    const expenseData = rows.map(r => r.annualExpense);

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '年間収入 / 積立',
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderRadius: 3
          },
          {
            label: '年間支出 / 取り崩し',
            data: expenseData,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatMan(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxTicksLimit: 12 }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (v) => formatMan(v)
            }
          }
        }
      }
    });
  }
}

function renderTable(rows) {
  const tbody = document.getElementById('cashflowTableBody');
  document.getElementById('tableRowCountLabel').textContent = `全${rows.length}年間`;

  tbody.innerHTML = rows.map(r => {
    const isRetiredBadge = r.isRetired 
      ? '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">リタイア</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">積立期</span>';

    const gainClass = r.investmentGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 font-bold';
    const returnClass = r.returnRate < 0 ? 'text-rose-500 font-bold' : '';

    return `
      <tr class="${r.isCrashYear ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}">
        <td class="py-2 px-3 font-medium">${r.age}歳</td>
        <td class="py-2 px-3">${isRetiredBadge}</td>
        <td class="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">+${r.annualIncome.toLocaleString()}万</td>
        <td class="py-2 px-3 text-right text-rose-500">${r.annualExpense > 0 ? `-${r.annualExpense.toLocaleString()}万` : '0万'}</td>
        <td class="py-2 px-3 text-right ${returnClass}">${r.returnRate > 0 ? `+${r.returnRate.toFixed(1)}%` : `${r.returnRate.toFixed(1)}%`}</td>
        <td class="py-2 px-3 text-right ${gainClass}">${r.investmentGain >= 0 ? `+${r.investmentGain.toLocaleString()}万` : `${r.investmentGain.toLocaleString()}万`}</td>
        <td class="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">${r.totalAsset.toLocaleString()}万円</td>
        <td class="py-2 px-3 text-right text-slate-500">${r.realAsset.toLocaleString()}万円</td>
        <td class="py-2 px-3 text-slate-500 truncate max-w-[180px]" title="${r.eventNote}">${r.eventNote || '-'}</td>
      </tr>
    `;
  }).join('');
}

function setupEventModal() {
  const modal = document.getElementById('eventModal');
  const btnAdd = document.getElementById('btnAddEvent');
  const btnClose = document.getElementById('btnCloseEventModal');
  const btnCancel = document.getElementById('btnCancelEventModal');
  const btnSave = document.getElementById('btnSaveEventModal');

  btnAdd.addEventListener('click', () => {
    document.getElementById('modalEventName').value = '';
    document.getElementById('modalEventAge').value = state.currentAge + 5;
    document.getElementById('modalEventAmount').value = -300;
    modal.classList.remove('hidden');
  });

  const closeModal = () => modal.classList.add('hidden');
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  document.querySelectorAll('.preset-event-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('modalEventName').value = btn.dataset.name;
      document.getElementById('modalEventAmount').value = btn.dataset.amount;
    });
  });

  btnSave.addEventListener('click', () => {
    const name = document.getElementById('modalEventName').value.trim() || '一時収支';
    let age = parseInt(document.getElementById('modalEventAge').value, 10);
    let amount = parseFloat(document.getElementById('modalEventAmount').value);

    if (isNaN(age)) age = state.currentAge + 5;
    age = Math.max(18, Math.min(PARAM_LIMITS.endAge.max, age));

    if (isNaN(amount)) amount = 0;
    amount = Math.max(-100000, Math.min(100000, amount));

    state.events.push({
      id: 'ev_' + Date.now(),
      name,
      age,
      amount
    });

    closeModal();
    onStateChange();
  });
}

function renderEventList() {
  const container = document.getElementById('eventListContainer');
  if (state.events.length === 0) {
    container.innerHTML = '<div class="text-slate-400 text-center py-2">登録されたイベントはありません</div>';
    return;
  }

  container.innerHTML = state.events.map(ev => {
    const isCost = ev.amount < 0;
    const badgeColor = isCost 
      ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900' 
      : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900';

    return `
      <div class="flex items-center justify-between p-2 rounded-xl border ${badgeColor}">
        <div>
          <span class="font-bold">${ev.age}歳:</span> ${ev.name}
        </div>
        <div class="flex items-center space-x-2">
          <span class="font-bold">${ev.amount > 0 ? `+${ev.amount}` : ev.amount}万円</span>
          <button onclick="removeEvent('${ev.id}')" class="text-slate-400 hover:text-rose-500 transition p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.removeEvent = function(id) {
  state.events = state.events.filter(e => e.id !== id);
  onStateChange();
};

function formatMan(val) {
  if (val >= 10000) {
    const oku = Math.floor(val / 10000);
    const man = Math.round(val % 10000);
    return man > 0 ? `${oku}億${man.toLocaleString()}万円` : `${oku}億円`;
  }
  return `${Math.round(val).toLocaleString()}万円`;
}

function applyPreset(p) {
  state = sanitizeState({ ...state, ...p });
  syncControlsToState();
  onStateChange();
}

function syncControlsToState() {
  document.getElementById('currentAge').value = state.currentAge;
  document.getElementById('currentAgeNum').value = state.currentAge;
  document.getElementById('currentAgeVal').textContent = `${state.currentAge}歳`;

  document.getElementById('retireAge').value = state.retireAge;
  document.getElementById('retireAgeNum').value = state.retireAge;
  document.getElementById('retireAgeVal').textContent = `${state.retireAge}歳`;

  document.getElementById('endAge').value = state.endAge;
  document.getElementById('endAgeNum').value = state.endAge;
  document.getElementById('endAgeVal').textContent = `${state.endAge}歳`;

  document.getElementById('currentAsset').value = state.currentAsset;
  document.getElementById('currentAssetNum').value = state.currentAsset;
  document.getElementById('currentAssetVal').textContent = formatMan(state.currentAsset);

  document.getElementById('monthlyInvestment').value = state.monthlyInvestment;
  document.getElementById('monthlyInvestmentNum').value = state.monthlyInvestment;
  document.getElementById('monthlyInvestmentVal').textContent = `${state.monthlyInvestment}万円/月`;

  document.getElementById('annualBonusInvestment').value = state.annualBonusInvestment;
  document.getElementById('annualBonusInvestmentNum').value = state.annualBonusInvestment;
  document.getElementById('annualBonusInvestmentVal').textContent = `${state.annualBonusInvestment}万円/年`;

  document.getElementById('expectedReturn').value = state.expectedReturn;
  document.getElementById('expectedReturnNum').value = state.expectedReturn;
  document.getElementById('expectedReturnVal').textContent = `${state.expectedReturn.toFixed(1)}%`;

  document.getElementById('monthlyLivingCost').value = state.monthlyLivingCost;
  document.getElementById('monthlyLivingCostNum').value = state.monthlyLivingCost;
  document.getElementById('monthlyLivingCostVal').textContent = `${state.monthlyLivingCost}万円/月`;

  document.getElementById('enableSeverance').checked = state.enableSeverance;
  const chkSync = document.getElementById('syncSeveranceWithRetire');
  if (chkSync) chkSync.checked = (state.syncSeveranceWithRetire !== false);
  document.getElementById('severanceAge').value = state.severanceAge;
  document.getElementById('severanceAmount').value = state.severanceAmount;
  document.getElementById('severanceYears').value = state.severanceYears;

  document.getElementById('enableCrash').checked = state.enableCrash;
  document.getElementById('crashAge').value = state.crashAge;
  document.getElementById('crashDropRate').value = state.crashDropRate;
  document.getElementById('crashRecoveryYears').value = state.crashRecoveryYears;
  document.getElementById('crashBehavior').value = state.crashBehavior;

  document.getElementById('enableSideFire').checked = state.enableSideFire;
  document.getElementById('sideFireMonthly').value = state.sideFireMonthly;
  document.getElementById('sideFireEndAge').value = state.sideFireEndAge;

  document.getElementById('enablePension').checked = state.enablePension;
  document.getElementById('pensionStartAge').value = state.pensionStartAge;
  document.getElementById('pensionMonthly').value = state.pensionMonthly;

  document.getElementById('nisaPriority').value = state.nisaPriority;
  document.getElementById('inflationRate').value = state.inflationRate;
  document.getElementById('salaryGrowthRate').value = state.salaryGrowthRate;

  setMode(state.mode);
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  renderChart();
}

function saveStateToLocal() {
  try {
    localStorage.setItem('assetforge_state', JSON.stringify(state));
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }
}

function loadSavedState() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  if (window.location.hash.length > 1) {
    try {
      const decoded = decodeURIComponent(atob(window.location.hash.substring(1)));
      const parsed = JSON.parse(decoded);
      state = sanitizeState({ ...DEFAULT_STATE, ...parsed });
      return;
    } catch (e) {
      console.warn('Hash parse error:', e);
    }
  }

  try {
    const saved = localStorage.getItem('assetforge_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = sanitizeState({ ...DEFAULT_STATE, ...parsed });
    }
  } catch (e) {
    console.warn('LocalStorage load error:', e);
  }
}

function shareUrl() {
  try {
    const compactState = { ...state };
    const encoded = btoa(encodeURIComponent(JSON.stringify(compactState)));
    window.location.hash = encoded;
    navigator.clipboard.writeText(window.location.href).then(() => {
      showToast('URLをクリップボードにコピーしました！共有できます');
    });
  } catch (e) {
    console.error(e);
  }
}

function exportCsv() {
  if (!currentSimulationResult) return;
  const rows = currentSimulationResult.rows;

  let csvContent = '\uFEFF年齢,状態,年間積立/収入(万円),年間支出(万円),利回り(%),運用損益(万円),年末資産残高(万円),実質価値(万円),主なイベント\r\n';
  rows.forEach(r => {
    csvContent += `"${r.age}歳","${r.isRetired ? 'リタイア' : '積立期'}","${r.annualIncome}","${r.annualExpense}","${r.returnRate}","${r.investmentGain}","${r.totalAsset}","${r.realAsset}","${r.eventNote.replace(/"/g, '""')}"\r\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `AssetForge_資産シミュレーション_${state.currentAge}歳-${state.endAge}歳.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('年表CSVをダウンロードしました');
}

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  msgEl.textContent = msg;
  toast.classList.remove('translate-y-12', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-12', 'opacity-0');
  }, 2500);
}

// ==========================================
// 7. プラン・パラメータ保存＆管理システム
// ==========================================

function loadSavedPlansFromStorage() {
  try {
    const raw = localStorage.getItem('assetforge_saved_plans');
    if (raw) {
      savedPlans = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load saved plans:', e);
    savedPlans = [];
  }
}

function savePlansToStorage() {
  try {
    localStorage.setItem('assetforge_saved_plans', JSON.stringify(savedPlans));
  } catch (e) {
    console.error('Failed to save plans to storage:', e);
  }
}

function setupPlanManagementModal() {
  loadSavedPlansFromStorage();

  const modal = document.getElementById('planManageModal');
  const btnOpen = document.getElementById('btnOpenPlanModal');
  const btnClose = document.getElementById('btnClosePlanModal');
  const btnSaveNew = document.getElementById('btnSaveNewPlan');
  const inputNewName = document.getElementById('inputNewPlanName');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnImportTrigger = document.getElementById('btnImportJsonTrigger');
  const inputJsonFile = document.getElementById('inputJsonFile');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      renderSavedPlanList();
      inputNewName.value = '';
      modal.classList.remove('hidden');
    });
  }

  const closeModal = () => modal.classList.add('hidden');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  if (btnSaveNew) {
    btnSaveNew.addEventListener('click', () => {
      const name = inputNewName.value.trim();
      saveCurrentPlan(name);
      inputNewName.value = '';
    });

    inputNewName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = inputNewName.value.trim();
        saveCurrentPlan(name);
        inputNewName.value = '';
      }
    });
  }

  // JSON エクスポート
  if (btnExportJson) {
    btnExportJson.addEventListener('click', exportPlansJson);
  }

  // JSON インポート
  if (btnImportTrigger && inputJsonFile) {
    btnImportTrigger.addEventListener('click', () => inputJsonFile.click());
    inputJsonFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importPlansJson(file);
        inputJsonFile.value = '';
      }
    });
  }

  renderSavedPlanList();
  updatePresetSelectWithUserPlans();
}

function saveCurrentPlan(customName) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const planName = customName || `マイプラン (${dateStr})`;
  const newPlan = {
    id: 'plan_' + Date.now(),
    name: planName,
    updatedAt: dateStr,
    data: JSON.parse(JSON.stringify(state))
  };

  savedPlans.unshift(newPlan);
  savePlansToStorage();
  renderSavedPlanList();
  updatePresetSelectWithUserPlans();
  showToast(`プラン「${planName}」を保存しました！`);
}

window.loadSavedPlan = function(id) {
  const plan = savedPlans.find(p => p.id === id);
  if (!plan) return;

  state = sanitizeState({ ...DEFAULT_STATE, ...JSON.parse(JSON.stringify(plan.data)) });
  syncControlsToState();
  onStateChange();

  const modal = document.getElementById('planManageModal');
  if (modal) modal.classList.add('hidden');

  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) presetSelect.value = `user_plan_${id}`;

  showToast(`プラン「${plan.name}」を読み込みました`);
};

window.overwriteSavedPlan = function(id) {
  const planIndex = savedPlans.findIndex(p => p.id === id);
  if (planIndex === -1) return;

  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  savedPlans[planIndex].data = JSON.parse(JSON.stringify(state));
  savedPlans[planIndex].updatedAt = dateStr;

  savePlansToStorage();
  renderSavedPlanList();
  showToast(`プラン「${savedPlans[planIndex].name}」を現在値で上書き保存しました`);
};

window.deleteSavedPlan = function(id) {
  const plan = savedPlans.find(p => p.id === id);
  const planName = plan ? plan.name : 'プラン';

  if (!confirm(`プラン「${planName}」を削除してもよろしいですか？`)) {
    return;
  }

  savedPlans = savedPlans.filter(p => p.id !== id);
  savePlansToStorage();
  renderSavedPlanList();
  updatePresetSelectWithUserPlans();
  showToast(`プラン「${planName}」を削除しました`);
};

function renderSavedPlanList() {
  const container = document.getElementById('savedPlanListContainer');
  const countLabel = document.getElementById('savedPlanCountLabel');
  if (!container) return;

  if (countLabel) countLabel.textContent = `${savedPlans.length}件`;

  if (savedPlans.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
        <i data-lucide="bookmark" class="w-6 h-6 mx-auto mb-1 opacity-40"></i>
        <p>保存されたプランはまだありません</p>
        <p class="text-[10px] mt-0.5">上のフォームから現在のパラメータに名前をつけて保存できます</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = savedPlans.map(plan => {
    const d = plan.data;
    const summary = `${d.currentAge}歳→${d.retireAge}歳リタイア | 月${d.monthlyInvestment}万積立 | 利回り${d.expectedReturn}% | ${formatMan(d.currentAsset)}`;

    return `
      <div class="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs hover:border-brand-500/50 transition">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${plan.name}</h4>
            <p class="text-[10px] text-slate-400 mt-0.5">更新: ${plan.updatedAt}</p>
            <div class="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 truncate">
              ${summary}
            </div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="loadSavedPlan('${plan.id}')" title="このプランを適用" class="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg border border-slate-200 dark:border-slate-600 transition">
              読込
            </button>
            <button onclick="overwriteSavedPlan('${plan.id}')" title="現在のパラメータで上書き保存" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteSavedPlan('${plan.id}')" title="削除" class="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function updatePresetSelectWithUserPlans() {
  const userGroup = document.getElementById('userPlansGroup');
  if (!userGroup) return;

  if (savedPlans.length === 0) {
    userGroup.innerHTML = '<option disabled>（保存されたプランはありません）</option>';
    return;
  }

  userGroup.innerHTML = savedPlans.map(plan => {
    return `<option value="user_plan_${plan.id}">📁 ${plan.name}</option>`;
  }).join('');
}

function exportPlansJson() {
  const exportPayload = {
    app: 'AssetForge',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    currentPlan: state,
    savedPlans: savedPlans
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.setAttribute('download', `AssetForge_プランバックアップ_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('全プランをJSONファイルとしてダウンロードしました');
}

function importPlansJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.savedPlans && Array.isArray(parsed.savedPlans)) {
        // 既存プランとID重複を避けながら結合
        const existingIds = new Set(savedPlans.map(p => p.id));
        let addedCount = 0;
        parsed.savedPlans.forEach(p => {
          if (!existingIds.has(p.id)) {
            savedPlans.push(p);
            existingIds.add(p.id);
            addedCount++;
          }
        });
        savePlansToStorage();
        renderSavedPlanList();
        updatePresetSelectWithUserPlans();

        if (parsed.currentPlan) {
          state = sanitizeState({ ...DEFAULT_STATE, ...parsed.currentPlan });
          syncControlsToState();
          onStateChange();
        }

        showToast(`JSONから ${addedCount} 件のプランを復元・適用しました！`);
      } else if (parsed.currentAge !== undefined) {
        // 単一のstate JSONの場合
        state = sanitizeState({ ...DEFAULT_STATE, ...parsed });
        syncControlsToState();
        onStateChange();
        showToast('パラメータを復元しました');
      } else {
        alert('無効なAssetForgeデータファイルです。');
      }
    } catch (err) {
      console.error(err);
      alert('JSONファイルの読み込みに失敗しました。形式をご確認ください。');
    }
  };
  reader.readAsText(file);
}

// 起動
document.addEventListener('DOMContentLoaded', initApp);

