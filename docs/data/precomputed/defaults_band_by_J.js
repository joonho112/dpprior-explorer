// written by scripts/extract_precomputed.mjs from verification/golden/marginal_quantiles.csv; do not edit
export default {
 "source": "verification/golden/marginal_quantiles.csv",
 "source_sha256": "bb48412d041b6e8b300b1cc3c7973e451fa51b2546a142bceb36fa426f61cdf6",
 "method": "DPprior 2.0.0 (load_all); integrate() on log-alpha panels; log-Stirling row extended beyond the package's J <= 500 cap",
 "note": "90% band [q05, q95] of K_J for J > 500, where the browser does not compute the pmf live",
 "priors": {
  "vague": {
   "a": 1,
   "b": 1,
   "rows": [
    {
     "J": 1000,
     "q05": 1,
     "median": 5,
     "q95": 19
    },
    {
     "J": 2000,
     "q05": 1,
     "median": 6,
     "q95": 21
    },
    {
     "J": 5000,
     "q05": 1,
     "median": 7,
     "q95": 24
    }
   ]
  },
  "lit24": {
   "a": 2,
   "b": 4,
   "rows": [
    {
     "J": 1000,
     "q05": 1,
     "median": 4,
     "q95": 10
    },
    {
     "J": 2000,
     "q05": 1,
     "median": 4,
     "q95": 11
    },
    {
     "J": 5000,
     "q05": 1,
     "median": 4,
     "q95": 12
    }
   ]
  },
  "lit13": {
   "a": 1,
   "b": 3,
   "rows": [
    {
     "J": 1000,
     "q05": 1,
     "median": 2,
     "q95": 8
    },
    {
     "J": 2000,
     "q05": 1,
     "median": 3,
     "q95": 9
    },
    {
     "J": 5000,
     "q05": 1,
     "median": 3,
     "q95": 10
    }
   ]
  },
  "alpha1": {
   "alpha": 1,
   "rows": [
    {
     "J": 1000,
     "q05": 4,
     "median": 7,
     "q95": 12
    },
    {
     "J": 2000,
     "q05": 4,
     "median": 8,
     "q95": 13
    },
    {
     "J": 5000,
     "q05": 5,
     "median": 9,
     "q95": 14
    }
   ]
  }
 }
};
