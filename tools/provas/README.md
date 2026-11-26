# Pipeline das provas anteriores

Sequência para montar "1 prova anterior por concurso" gastando o mínimo de IA: os scripts fazem a busca,
o download, a extração e a validação; a IA só entra na conferência por amostragem.

| Etapa | Script | O que faz |
|---|---|---|
| 1. Descoberta | `discover.py` | Consulta o conector oficial da PCI Concursos (`pesquisar_provas`) e lista as provas anteriores de cada órgão (ano, cargo, banca). Só descoberta: os PDFs da PCI ficam atrás de verificação anti-robô e não são baixados por script. |
| 2. Fonte oficial | `src_cebraspe.py`, `src_fgv.py` | Acha a edição anterior no site da banca (API pública do Cebraspe; páginas da FGV Conhecimento), escolhe o cargo mais parecido e baixa caderno + gabarito definitivo. |
| 3. Extração | `extract.py` | Lê o PDF em ordem de leitura (2 colunas), tira cabeçalho/rodapé, separa questões, alternativas (A–E) ou itens Certo/Errado, textos de apoio e disciplina. |
| 4. Gabarito | `gabarito.py` | Lê "1 - A", grades de números/letras e seções por versão/tipo de caderno. |
| 5. Montagem e validação | `build.py`, `clean.py` | Casa caderno ↔ gabarito (mesma versão), recusa a prova se faltar questão, sobrar resposta, faltar alternativa ou a versão for ambígua. |
| 6. QA | `qa.py` | Sinais de texto quebrado ou vazamento de texto de apoio. Depois: conferência por amostragem (2 questões por prova). |
| 7. Publicação | `publish.mjs` | Grava `public/provas/<concurso>.json` e o índice leve `public/provas/index.json`. Nunca sobrescreve as provas de `public/js/data/provas.js`. |

Orquestração: `run_batch.py [ids...]` (sem ids = todos os concursos ativos).
Requisitos: Python 3.12 com PyMuPDF, `pdftotext` (Poppler), Node 20+.
Os dados de trabalho (PDFs, jobs, relatórios) ficam fora do repositório.
