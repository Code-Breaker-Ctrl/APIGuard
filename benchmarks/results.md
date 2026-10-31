# APIGuard Benchmark Results
*Measured automatically on 2026-10-31T08:59:56Z against target: `http://127.0.0.1:8000/target`*

## Variant Comparison Table
| Variant | GT | Base Confirmed | Base Recall | Base Prec | Base Req/Fnd | APIGuard Confirmed | APIGuard Recall | APIGuard Prec | APIGuard Req/Fnd | Time 1st (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `variant_a` | 1 | 1 | 100% | 100% | 7.0 | **1** | **100%** | **100%** | **15.0** | 15.4ms |
| `variant_b` | 1 | 0 | 0% | 0% | - | **1** | **100%** | **100%** | **15.0** | 12.8ms |
| `variant_c` | 1 | 1 | 100% | 100% | 7.0 | **1** | **100%** | **100%** | **15.0** | 9.7ms |
| `variant_all` | 3 | 2 | 67% | 100% | 3.5 | **3** | **100%** | **100%** | **6.3** | 5.0ms |
| `variant_secure` | 0 | 0 | n/a | 100% | - | **0** | **n/a** | **100%** | **-** | - |

## Ablations (Measured on Defect B Variant)
| Configuration | Confirmed | Recall | Precision | Requests | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **APIGuard (Propagation ON)** | 1 | 100% | 100% | 15 | Full Graph-Guided Scanner |
| **Ablation: Propagation OFF** | 0 | 0% | 0% | 6 | Rule propagation disabled |
| **Ablation: Oracle Baseline** | 1 | 100% | 100% | 9 | Baseline with a manual rule for every route |

## Key Takeaways
- **Defect B (Variant `variant_b`):** APIGuard achieves **100% recall** by propagating ownership rules to graph-adjacent operations. Baseline achieves **0% recall** because it evaluates `/export` without DAG context.
- **Zero False Positives:** In `variant_secure`, APIGuard maintains **100% precision** with 0 false positives.
- **Ablation:** See the ablation table above; all values are measured in this run.