# Provas anteriores — como publicar uma prova

A tela de resolução fica em `/prova.html?concurso=<id>&ano=<ano>` e lê os dados de
`public/js/data/provas.js`.

## 1. Consiga o material conferido

Para cada prova, é preciso ter em mãos:

- o **caderno oficial** da prova (PDF publicado pela banca);
- o **gabarito definitivo** (não o preliminar, nem o gabarito de cursinho);
- o **cargo** e o **ano** a que aquele caderno corresponde.

Os 5 anos que aparecem em cada concurso vêm de `provasAnteriores`, no catálogo.
Sem caderno e gabarito oficiais, a prova continua com `status: "amostra"` e a
página avisa que é uma prévia.

## 2. Preencha o registro

```js
"id-do-concurso": {
  2025: {
    edicao: "PM-SP 2025",
    ano: 2025,
    banca: "Fundação Vunesp",
    cargo: "Aluno-Soldado PM de 2ª Classe",
    totalQuestoes: 60,          // total do caderno oficial
    status: "completa",         // "completa" quando o caderno inteiro entrou
    fonte: "https://.../caderno.pdf",
    gabaritoFonte: "https://.../gabarito.pdf",
    questoes: [
      {
        numero: 1,
        disciplina: "Língua Portuguesa",
        enunciado: "Texto da questão. Parágrafos separados por uma linha em branco.",
        alternativas: [
          { letra: "A", texto: "..." },
          { letra: "B", texto: "..." },
          { letra: "C", texto: "..." },
          { letra: "D", texto: "..." },
          { letra: "E", texto: "..." }
        ],
        correta: "B",
        explicacao: "Por que a alternativa correta é a correta e o erro das outras.",
        fonte: "Gabarito oficial — questão 1"
      }
    ]
  }
}
```

## 3. O que a tela já faz sozinha

- progresso e mapa da prova, com acerto/erro por questão;
- confirmação da resposta com gabarito e explicação logo abaixo;
- resultado com percentual, acertos, erros, em branco e desempenho por disciplina;
- revisão questão por questão e "refazer a prova";
- salvamento do progresso no navegador (a pessoa pode fechar e voltar);
- atalhos de teclado: `A` a `E` para marcar, `Enter` para confirmar/avançar.

## 4. Regras editoriais

- Uma questão só entra com o texto conferido contra o caderno oficial.
- A explicação é redigida por nós; ela não substitui o gabarito da banca.
- Se o caderno tiver imagem, tabela ou gráfico, a questão fica para depois: a
  tela atual não exibe figura.
- O campo `fonte` da questão deve dizer de onde veio (gabarito oficial, página
  do caderno, número da questão).
