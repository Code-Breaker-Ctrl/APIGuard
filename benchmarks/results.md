# APIGuard Benchmark Results
*Measured automatically on 2026-10-21T23:49:40Z against target: `http://127.0.0.1:8000/target`*

## Summary Table
| Variant | Ground Truth | Baseline Confirmed | Baseline Recall | Baseline Prec | APIGuard Confirmed | APIGuard Recall | APIGuard Prec |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `variant_a` | 1 | 1 | 100% | 100% | **1** | **100%** | **100%** |
| `variant_b` | 1 | 0 | 0% | 0% | **1** | **100%** | **100%** |
| `variant_c` | 1 | 1 | 100% | 100% | **1** | **100%** | **100%** |
| `variant_all` | 3 | 2 | 67% | 100% | **3** | **100%** | **100%** |
| `variant_secure` | 0 | 0 | 100% | 100% | **0** | **100%** | **100%** |

## Key Takeaways
- **Defect B (Variant `variant_b`):** APIGuard confirmed the propagated leak on `/projects/{id}/export` (100% recall), while the baseline had 0% recall.
- **Zero False Positives:** In `variant_secure`, both scanners produced 0 false positives (100% precision).
- **Requests per Finding:** APIGuard found vulnerabilities with bounded traversal and minimal request budgets.