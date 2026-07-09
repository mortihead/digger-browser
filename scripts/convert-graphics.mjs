/**
 * Одноразовый конвертер графических данных из Java в TypeScript.
 *
 * Переносит зашитые в код массивы спрайтов/шрифта из исходников оригинала
 * (CgaGrafx.java, Alphabet.java) в TS-модули. Сами числовые данные в Java и TS
 * записываются одинаково (0x.., десятичные, комментарии /* *\/ и //, null),
 * поэтому переписываются только объявления:
 *
 *   static final short[]   NAME = { ... };  ->  export const NAME: number[] = [ ... ];
 *   static final short[][] NAME = { ... };  ->  export const NAME: (number[] | null)[] = [ ... ];
 *
 * Запуск: node scripts/convert-graphics.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC_DIR = "../digger/src/main/java/org/digger/app";

/** Конвертирует один Java-файл с массивами в TS-модуль. */
function convert(javaPath, tsPath, header) {
  // Нормализуем переносы строк: часть исходников в CRLF, остаточный \r ломает регулярки.
  const lines = readFileSync(javaPath, "utf8").replace(/\r\n/g, "\n").split("\n");
  const out = [header, ""];

  for (const line of lines) {
    const trimmed = line.trim();

    // Отбрасываем package и объявление/закрытие класса.
    if (trimmed.startsWith("package ")) continue;
    if (/^(abstract\s+)?class\s+\w+\s*\{$/.test(trimmed)) continue;
    if (trimmed === "}") continue; // закрывающая скобка класса

    // Преобразуем объявления: "static final short[]([]) NAME = {" -> "export const NAME: T = [".
    // Закрытие инициализатора "};" может стоять как отдельной строкой (CgaGrafx),
    // так и в конце строки с данными (Alphabet) — заменяем его в любой позиции.
    let converted = line
      .replace(/static final short\[\]\[\] (\w+) = \{/, "export const $1: (number[] | null)[] = [")
      .replace(/static final short\[\] (\w+) = \{/, "export const $1: number[] = [")
      .replace(/\};/g, "];");

    out.push(converted);
  }

  writeFileSync(tsPath, out.join("\n"));
  console.log(`${javaPath} -> ${tsPath} (${out.length} строк)`);
}

convert(
  `${SRC_DIR}/CgaGrafx.java`,
  "src/CgaGrafx.ts",
  "// Графические данные CGA. Сгенерировано из CgaGrafx.java (scripts/convert-graphics.mjs). Не редактировать вручную.",
);
convert(
  `${SRC_DIR}/Alphabet.java`,
  "src/Alphabet.ts",
  "// Данные шрифта CGA. Сгенерировано из Alphabet.java (scripts/convert-graphics.mjs). Не редактировать вручную.",
);
