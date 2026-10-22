# APIGuard Benchmark Results
*Measured automatically on 2026-10-21T23:59:08Z against target: `http://127.0.0.1:8000/target`*

## Variant Comparison Table
| Variant | GT | Base Confirmed | Base Recall | Base Prec | Base Req/Fnd | APIGuard Confirmed | APIGuard Recall | APIGuard Prec | APIGuard Req/Fnd | Time 1st (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `variant_a` | 1 | 1 | 100% | 100% | 7.0 | **1** | **100%** | **100%** | **13.0** | 15.2ms |
| `variant_b` | 1 | 0 | 0% | 0% | - | **1** | **100%** | **100%** | **13.0** | 16.2ms |
| `variant_c` | 1 | 1 | 100% | 100% | 7.0 | **1** | **100%** | **100%** | **13.0** | 9.8ms |
| `variant_all` | 3 | 2 | 67% | 100% | 3.5 | **3** | **100%** | **100%** | **5.7** | 6.2ms |
| `variant_secure` | 0 | 0 | n/a | 100% | - | **0** | **n/a** | **100%** | **-** | - |

## Ablations (Measured on Defect B Variant)
| Configuration | Confirmed | Recall | Precision | Requests | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **APIGuard (Propagation ON)** | **1** | **100%** | **100%** | 13 | Full Graph-Guided Scanner |
| **Ablation: Propagation OFF** | **0** | **0%** | **0%** | 5 | Disabling rule propagation causes scanner to miss Defect B entirely |
| **Ablation: Oracle Baseline** | **1** | **100%** | **100%** | 9 | Baseline matches graph only with manual rule specification for every route |

## Key Takeaways
- **Defect B (Variant `variant_b`):** APIGuard achieves **100% recall** by propagating ownership rules to graph-adjacent operations. Baseline achieves **0% recall** because it evaluates `/export` without DAG context.
- **Zero False Positives:** In `variant_secure`, APIGuard maintains **100% precision** with 0 false positives.
- **Ablation:** In our ablation, disabling propagation missed the indirect defect (1 defect, 1 target API).