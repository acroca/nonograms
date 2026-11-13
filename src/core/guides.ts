import type { Lang } from './i18n';

export interface Example {
  /** Rows of space-separated tokens; see `renderExample` in guide.ts. */
  grid?: string[];
  /** Monospace drawing, for games that don't fit a grid. */
  pre?: string;
  caption: string;
}

export interface Guide {
  goal: string;
  rules: string[];
  controls: string[];
  examples: Example[];
  tips: string[];
}

type Bi<T> = { en: T; es: T };
type RawGuide = Omit<{ [K in keyof Guide]: Bi<Guide[K]> }, 'examples'> & { examples: Bi<Example>[] };

const ex = (grid: string[] | undefined, pre: string | undefined, en: string, es: string): Bi<Example> => ({
  en: { grid, pre, caption: en },
  es: { grid, pre, caption: es },
});

const RAW: Record<string, RawGuide> = {
  nonogram: {
    goal: {
      en: 'Reveal a hidden picture by deciding which squares are filled and which are empty.',
      es: 'Descubre una imagen oculta decidiendo qué casillas se rellenan y cuáles quedan vacías.',
    },
    rules: {
      en: [
        'The numbers beside a row (or above a column) are the lengths of its runs of consecutive filled squares, in order.',
        'Two runs are always separated by at least one empty square.',
        'A clue of 0 means the whole line is empty.',
        'When a line matches its clue exactly, its numbers turn grey.',
      ],
      es: [
        'Los números junto a una fila (o sobre una columna) son las longitudes de sus tramos de casillas rellenas consecutivas, en orden.',
        'Dos tramos siempre están separados por al menos una casilla vacía.',
        'Una pista de 0 significa que toda la línea está vacía.',
        'Cuando una línea cumple exactamente su pista, sus números se ponen grises.',
      ],
    },
    controls: {
      en: [
        'Pick Fill or Block at the bottom. Fill paints a square; Block marks a square you know is empty.',
        'Tap a square, or drag along a row or column to paint several at once.',
        'Dragging only changes squares in the same state as the first one you touched.',
      ],
      es: [
        'Elige Rellenar o Bloquear abajo. Rellenar pinta una casilla; Bloquear marca una casilla que sabes que está vacía.',
        'Toca una casilla, o arrastra por una fila o columna para pintar varias a la vez.',
        'Al arrastrar solo cambian las casillas que están en el mismo estado que la primera que tocaste.',
      ],
    },
    examples: [
      ex(['# # . # .'], undefined, 'In a row of 5, the clue “2 1” means a run of two, a gap, then a single square.', 'En una fila de 5, la pista «2 1» significa un tramo de dos, un hueco y una casilla suelta.'),
      ex(['# # # # *#'], undefined, 'A clue “5” in a row of 5 fills every square. Look for big clues like this first.', 'Una pista «5» en una fila de 5 rellena todas las casillas. Busca primero pistas grandes como esta.'),
    ],
    tips: {
      en: [
        'Start with lines whose clues nearly fill the line: “4 3” in 8 squares has no spare room.',
        'Big runs overlap with themselves: a run of 7 in 10 squares must fill the middle 4.',
        'Block squares you know are empty; it makes the remaining clues easier to place.',
      ],
      es: [
        'Empieza por líneas cuyas pistas casi llenan la línea: «4 3» en 8 casillas no deja espacio libre.',
        'Los tramos grandes se solapan consigo mismos: un tramo de 7 en 10 casillas debe rellenar las 4 centrales.',
        'Bloquea las casillas que sabes vacías; así es más fácil colocar las pistas restantes.',
      ],
    },
  },

  binairo: {
    goal: {
      en: 'Fill the grid with 0s and 1s following three simple rules.',
      es: 'Llena la cuadrícula con 0 y 1 siguiendo tres reglas sencillas.',
    },
    rules: {
      en: [
        'No more than two equal digits can be next to each other, in a row or a column.',
        'Every row and column has the same number of 0s and 1s.',
        'No two rows are identical, and no two columns are identical.',
        'Square tiles are given and can’t be changed.',
      ],
      es: [
        'No puede haber más de dos dígitos iguales seguidos, en una fila o una columna.',
        'Cada fila y columna tiene la misma cantidad de 0 y de 1.',
        'No hay dos filas idénticas ni dos columnas idénticas.',
        'Las casillas cuadradas vienen dadas y no se pueden cambiar.',
      ],
    },
    controls: {
      en: ['Tap a cell to cycle: empty → 0 → 1 → empty.', 'Drag across cells to copy the first cell’s new value along your path.'],
      es: ['Toca una casilla para alternar: vacía → 0 → 1 → vacía.', 'Arrastra por las casillas para copiar el nuevo valor de la primera a lo largo del recorrido.'],
    },
    examples: [
      ex(['0 0 *1 . . .'], undefined, 'Two 0s side by side: the next cell can’t be another 0, so it must be 1.', 'Dos 0 juntos: la siguiente casilla no puede ser otro 0, así que debe ser 1.'),
      ex(['1 *0 1 . . .'], undefined, 'A gap between two equal digits must hold the other digit, otherwise three in a row would appear.', 'Un hueco entre dos dígitos iguales debe llevar el otro dígito; si no, aparecerían tres seguidos.'),
      ex(['1 0 1 1 *0 *0'], undefined, 'In a 6-wide row, once three 1s are placed, every remaining cell must be 0 (and vice versa).', 'En una fila de 6, cuando ya hay tres 1, todas las casillas restantes deben ser 0 (y viceversa).'),
    ],
    tips: {
      en: ['Scan for pairs and for “x _ x” gaps first.', 'Count 0s and 1s in each line; a line that already has half of one digit is finished for that digit.', 'Use the “no identical lines” rule at the end, on nearly complete lines.'],
      es: ['Busca primero parejas y huecos del tipo «x _ x».', 'Cuenta los 0 y 1 de cada línea; si ya tiene la mitad de un dígito, no admite más de ese dígito.', 'Usa la regla de «sin líneas idénticas» al final, con líneas casi completas.'],
    },
  },

  queens: {
    goal: {
      en: 'Place queens so that every row, column and colored region has exactly one.',
      es: 'Coloca reinas de modo que cada fila, columna y región de color tenga exactamente una.',
    },
    rules: {
      en: ['Exactly one queen in each row.', 'Exactly one queen in each column.', 'Exactly one queen in each colored region.', 'Queens can’t touch each other, not even diagonally.'],
      es: ['Exactamente una reina en cada fila.', 'Exactamente una reina en cada columna.', 'Exactamente una reina en cada región de color.', 'Las reinas no pueden tocarse, ni siquiera en diagonal.'],
    },
    controls: {
      en: ['Tap once for ✕ (no queen here), twice for a queen, three times to clear.', 'Drag to put ✕ on several cells; a drag that starts on a ✕ erases them instead.', 'In Settings, “Auto-✕” crosses out cells that a queen rules out for you.'],
      es: ['Toca una vez para ✕ (aquí no hay reina), dos veces para una reina, tres para borrar.', 'Arrastra para poner ✕ en varias casillas; si empiezas sobre una ✕, las borra.', 'En Ajustes, «Auto-✕» tacha por ti las casillas que descarta una reina.'],
    },
    examples: [
      ex(['. ♛ . .', '. . . ♛', '♛ . . .', '. . ♛ .'], undefined, 'A solved 4×4 grid: one queen per row and column, and none touching, even diagonally.', 'Una cuadrícula 4×4 resuelta: una reina por fila y columna, y ninguna se toca, ni en diagonal.'),
    ],
    tips: {
      en: ['A region that fits in a single row or column forces that line’s queen: ✕ the rest of that line.', 'If two regions share only two rows, no other region can have a queen in those rows.', 'Turn on region patterns in Settings if the colors are hard to tell apart.'],
      es: ['Una región que cabe en una sola fila o columna fuerza la reina de esa línea: pon ✕ en el resto de la línea.', 'Si dos regiones solo ocupan dos filas, ninguna otra región puede tener reina en esas filas.', 'Activa los patrones de región en Ajustes si te cuesta distinguir los colores.'],
    },
  },

  sudoku: {
    goal: {
      en: 'Fill the grid with digits 1 to 9 (1 to 4 on a 4×4 grid, 1 to 6 on a 6×6 grid).',
      es: 'Llena la cuadrícula con los dígitos del 1 al 9 (del 1 al 4 en 4×4, del 1 al 6 en 6×6).',
    },
    rules: {
      en: ['Each row contains every digit exactly once.', 'Each column contains every digit exactly once.', 'Each box (thick lines: 3×3 on 9×9, 2×3 on 6×6, 2×2 on 4×4) contains every digit exactly once.', 'Given digits can’t be changed.', 'Pick the size (4×4, 6×6 or 9×9) when starting a new puzzle.'],
      es: ['Cada fila contiene cada dígito exactamente una vez.', 'Cada columna contiene cada dígito exactamente una vez.', 'Cada caja (líneas gruesas: 3×3 en 9×9, 2×3 en 6×6, 2×2 en 4×4) contiene cada dígito exactamente una vez.', 'Los dígitos dados no se pueden cambiar.', 'Elige el tamaño (4×4, 6×6 o 9×9) al empezar un nuevo puzzle.'],
    },
    controls: {
      en: ['Tap a cell, then tap a number on the pad. Tap the same number again (or ⌫) to clear it.', 'Turn on Notes to pencil in candidates. Entering a digit removes it from the notes in its row, column and box.', 'The selected cell’s row, column and box are shaded, and matching digits are highlighted.'],
      es: ['Toca una casilla y luego un número del teclado. Toca el mismo número otra vez (o ⌫) para borrarlo.', 'Activa Notas para anotar candidatos. Al poner un dígito se quita de las notas de su fila, columna y caja.', 'La fila, columna y caja de la casilla seleccionada se sombrean, y los dígitos iguales se resaltan.'],
    },
    examples: [
      ex(['5 3 4 6 7 8 9 1 *?'], undefined, 'This row holds 1, 3, 4, 5, 6, 7, 8 and 9. The only digit missing is 2, so ? = 2.', 'Esta fila tiene 1, 3, 4, 5, 6, 7, 8 y 9. El único dígito que falta es el 2, así que ? = 2.'),
    ],
    tips: {
      en: ['Look for a digit that can only go in one cell of a row, column or box (a “hidden single”).', 'Or a cell where only one digit is still possible (a “naked single”).', 'Use Notes when you get stuck: pairs of cells sharing the same two candidates are powerful clues.'],
      es: ['Busca un dígito que solo cabe en una casilla de una fila, columna o caja («single oculto»).', 'O una casilla donde solo es posible un dígito («single desnudo»).', 'Usa Notas si te atascas: dos casillas con los mismos dos candidatos son una pista muy potente.'],
    },
  },

  killer: {
    goal: {
      en: 'Solve a Sudoku where the clues are cages with sums instead of given digits.',
      es: 'Resuelve un Sudoku donde las pistas son jaulas con sumas en lugar de dígitos dados.',
    },
    rules: {
      en: ['All the normal Sudoku rules apply: 1–9 once in every row, column and 3×3 box.', 'The digits inside each dashed cage add up to the small number in its corner.', 'A digit can’t repeat inside a cage.'],
      es: ['Valen todas las reglas normales del Sudoku: del 1 al 9 una vez en cada fila, columna y caja de 3×3.', 'Los dígitos de cada jaula discontinua suman el número pequeño de su esquina.', 'Un dígito no puede repetirse dentro de una jaula.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad.', 'Use Notes to pencil in candidates.'],
      es: ['Toca una casilla y luego un número del teclado.', 'Usa Notas para anotar candidatos.'],
    },
    examples: [
      ex(['*? *?'], undefined, 'A cage of 2 cells with sum 3: the only digits are 1 and 2 (no repeats allowed).', 'Una jaula de 2 casillas con suma 3: los únicos dígitos son 1 y 2 (sin repetir).'),
      ex(['*? *?'], undefined, 'A cage of 2 cells with sum 17 can only be 8 and 9.', 'Una jaula de 2 casillas con suma 17 solo puede ser 8 y 9.'),
    ],
    tips: {
      en: ['Memorise the extremes: 2 cells = 3 → {1,2}; 3 cells = 6 → {1,2,3}; 3 cells = 24 → {7,8,9}.', 'A row, column or box sums to 45: use that to find single cells hiding between cages.'],
      es: ['Memoriza los extremos: 2 casillas = 3 → {1,2}; 3 casillas = 6 → {1,2,3}; 3 casillas = 24 → {7,8,9}.', 'Una fila, columna o caja suma 45: úsalo para encontrar casillas sueltas entre jaulas.'],
    },
  },

  kenken: {
    goal: {
      en: 'Fill an N×N grid with digits 1 to N, using the arithmetic clues of each cage.',
      es: 'Llena una cuadrícula N×N con dígitos del 1 al N, usando las pistas aritméticas de cada jaula.',
    },
    rules: {
      en: ['Each row and each column contains every digit from 1 to N exactly once.', 'Each outlined cage shows a target and an operation (+, −, × or ÷). Its digits must combine to the target.', '− and ÷ cages have two cells: subtract the smaller from the larger, or divide the larger by the smaller.', 'A digit may repeat inside a cage, as long as the cells are in different rows and columns.', 'A cage with just a number (no operation) is a given digit.'],
      es: ['Cada fila y cada columna contiene todos los dígitos del 1 al N exactamente una vez.', 'Cada jaula marcada muestra un objetivo y una operación (+, −, × o ÷). Sus dígitos deben combinarse para dar el objetivo.', 'Las jaulas − y ÷ tienen dos casillas: resta el menor al mayor, o divide el mayor entre el menor.', 'Un dígito puede repetirse dentro de una jaula si las casillas están en filas y columnas distintas.', 'Una jaula con solo un número (sin operación) es un dígito dado.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad.', 'Use Notes to pencil in candidates.'],
      es: ['Toca una casilla y luego un número del teclado.', 'Usa Notas para anotar candidatos.'],
    },
    examples: [
      ex(['1 2 3', '2 3 1', '3 1 2'], undefined, 'A valid 3×3 grid: each digit once per row and column. A “5+” cage on the last two cells of the first row would be 2 + 3; a “6×” cage there would also be 2 × 3.', 'Una cuadrícula 3×3 válida: cada dígito una vez por fila y columna. Una jaula «5+» en las dos últimas casillas de la primera fila sería 2 + 3; una «6×» también sería 2 × 3.'),
    ],
    tips: {
      en: ['Start with single-cell cages and big products or sums.', 'In a straight cage (one row or column), digits can’t repeat; in an L-shaped cage they can.'],
      es: ['Empieza por las jaulas de una casilla y las de productos o sumas grandes.', 'En una jaula recta (una fila o columna) los dígitos no pueden repetirse; en una jaula en L sí.'],
    },
  },

  futoshiki: {
    goal: {
      en: 'Fill the grid with 1 to N, obeying the inequality signs between cells.',
      es: 'Llena la cuadrícula con 1 a N, respetando los signos de desigualdad entre casillas.',
    },
    rules: {
      en: ['Each row and column contains every digit from 1 to N exactly once.', 'The sign between two cells must hold: the open side of the sign faces the larger digit.', 'A sign turns red if the digits on both sides break it.'],
      es: ['Cada fila y columna contiene todos los dígitos del 1 al N exactamente una vez.', 'El signo entre dos casillas debe cumplirse: el lado abierto del signo mira al dígito mayor.', 'Un signo se pone rojo si los dígitos a ambos lados lo incumplen.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad.', 'Use Notes to pencil in candidates.'],
      es: ['Toca una casilla y luego un número del teclado.', 'Usa Notas para anotar candidatos.'],
    },
    examples: [
      ex(['1 < *? > 2'], undefined, 'In a row of 3: the middle must be greater than 1 and greater than 2, so it is 3.', 'En una fila de 3: la casilla central debe ser mayor que 1 y mayor que 2, así que es 3.'),
      ex(['. < . < . < 4'], undefined, 'A chain of “<” signs is a ladder: with 4 digits it must be 1 < 2 < 3 < 4.', 'Una cadena de signos «<» es una escalera: con 4 dígitos solo puede ser 1 < 2 < 3 < 4.'),
    ],
    tips: {
      en: ['The smallest digit can’t be on the large side of a sign; the largest can’t be on the small side.', 'Follow chains of signs: a cell that is smaller than two others can’t be N.'],
      es: ['El dígito más pequeño no puede estar en el lado mayor de un signo; el más grande no puede estar en el lado menor.', 'Sigue las cadenas de signos: una casilla menor que otras dos no puede ser N.'],
    },
  },

  kakuro: {
    goal: {
      en: 'Fill the white cells with digits so every run adds up to its clue, like a crossword made of sums.',
      es: 'Llena las casillas blancas con dígitos para que cada tramo sume su pista, como un crucigrama de sumas.',
    },
    rules: {
      en: ['Fill every white cell with a digit from 1 to 9.', 'Each horizontal run adds up to the clue on its left (the number above the diagonal).', 'Each vertical run adds up to the clue above it (the number below the diagonal).', 'Digits can’t repeat within a run.'],
      es: ['Llena cada casilla blanca con un dígito del 1 al 9.', 'Cada tramo horizontal suma la pista de su izquierda (el número sobre la diagonal).', 'Cada tramo vertical suma la pista de arriba (el número bajo la diagonal).', 'Los dígitos no pueden repetirse dentro de un tramo.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad. Use Notes for candidates.', 'Turn on “Show combinations” in Settings: it lists the digit sets that fit the selected runs.'],
      es: ['Toca una casilla y luego un número del teclado. Usa Notas para candidatos.', 'Activa «Mostrar combinaciones» en Ajustes: lista los conjuntos de dígitos que encajan en los tramos seleccionados.'],
    },
    examples: [
      ex(['3→ *? *?'], undefined, 'A run of 2 cells that sums to 3 can only use 1 and 2.', 'Un tramo de 2 casillas que suma 3 solo puede usar 1 y 2.'),
      ex(['16→ *? *?'], undefined, 'A run of 2 cells with sum 16 can only be 7 + 9.', 'Un tramo de 2 casillas con suma 16 solo puede ser 7 + 9.'),
    ],
    tips: {
      en: ['Learn the unique sets: 2 cells → 3, 4, 16, 17; 3 cells → 6, 7, 23, 24.', 'When a cell belongs to two runs, only digits allowed by both are possible.'],
      es: ['Aprende los conjuntos únicos: 2 casillas → 3, 4, 16, 17; 3 casillas → 6, 7, 23, 24.', 'Cuando una casilla pertenece a dos tramos, solo valen los dígitos permitidos por ambos.'],
    },
  },

  hitori: {
    goal: {
      en: 'Shade some cells so that no number repeats in any row or column among the unshaded cells.',
      es: 'Sombrea algunas casillas para que ningún número se repita en ninguna fila o columna entre las casillas sin sombrear.',
    },
    rules: {
      en: ['Among the unshaded cells, a number may appear only once per row and per column.', 'Shaded cells can’t touch each other side by side (diagonals are fine).', 'All unshaded cells must stay connected in a single area.'],
      es: ['Entre las casillas sin sombrear, un número solo puede aparecer una vez por fila y por columna.', 'Las casillas sombreadas no pueden tocarse por los lados (en diagonal sí).', 'Todas las casillas sin sombrear deben seguir conectadas en una única zona.'],
    },
    controls: {
      en: ['Tap to cycle: plain → shaded → circled (a cell you know stays unshaded).', 'Drag to apply the same mark to several cells.'],
      es: ['Toca para alternar: normal → sombreada → rodeada (una casilla que sabes que no se sombrea).', 'Arrastra para aplicar la misma marca a varias casillas.'],
    },
    examples: [
      ex(['1 #2 2 3'], undefined, 'The two 2s clash in this row: shade one of them. The other 2 stays.', 'Los dos 2 chocan en esta fila: sombrea uno de ellos. El otro 2 se queda.'),
      ex(['1 #2 #2 3'], undefined, 'Not allowed: shaded cells can’t be next to each other.', 'No permitido: las casillas sombreadas no pueden estar juntas.'),
    ],
    tips: {
      en: ['If three equal numbers are in a row, shade the two outer ones… or the middle one.', 'When you shade a cell, circle all its neighbours: they can’t be shaded.', 'If a unique number can’t be shaded, circle it: that helps rule out other cells.'],
      es: ['Si hay tres números iguales seguidos, sombrea los dos de los extremos… o el del medio.', 'Cuando sombrees una casilla, rodea todos sus vecinos: no pueden sombrearse.', 'Si un número único no puede sombrearse, rodéalo: ayuda a descartar otras casillas.'],
    },
  },

  nurikabe: {
    goal: {
      en: 'Decide which cells are sea and which are island. Numbers are island sizes.',
      es: 'Decide qué casillas son mar y cuáles isla. Los números son tamaños de isla.',
    },
    rules: {
      en: ['Each number is part of an island of exactly that many cells; every island has exactly one number.', 'Islands can’t touch each other side by side.', 'All the other cells are sea, and the sea forms a single connected area.', 'There can be no 2×2 block of sea anywhere.'],
      es: ['Cada número es parte de una isla con exactamente esa cantidad de casillas; cada isla tiene exactamente un número.', 'Las islas no pueden tocarse por los lados.', 'Todas las demás casillas son mar, y el mar forma una única zona conectada.', 'No puede haber ningún bloque de 2×2 de mar.'],
    },
    controls: {
      en: ['Tap to cycle: empty → sea → dot (island) → empty.', 'Drag to apply the same mark to several cells.'],
      es: ['Toca para alternar: vacía → mar → punto (isla) → vacía.', 'Arrastra para aplicar la misma marca a varias casillas.'],
    },
    examples: [
      ex(['2 • #', '# # #', '1 # 1'], undefined, 'A solved 3×3. The “2” island is the 2 and the dot (•) next to it; each “1” is a lone cell; # is sea. The sea is connected and has no 2×2 block.', 'Un 3×3 resuelto. La isla «2» es el 2 y el punto a su lado; cada «1» es una casilla suelta; # es mar. El mar está conectado y no tiene bloques 2×2.'),
    ],
    tips: {
      en: ['Cells next to a “1” are sea. A cell between two different numbers must be sea.', 'If a 2×2 area has three sea cells, the fourth must be island.', 'Sea cells that are cut off need a path to the rest of the sea.'],
      es: ['Las casillas junto a un «1» son mar. Una casilla entre dos números distintos debe ser mar.', 'Si un área 2×2 tiene tres casillas de mar, la cuarta debe ser isla.', 'Las casillas de mar aisladas necesitan un camino hacia el resto del mar.'],
    },
  },

  slitherlink: {
    goal: {
      en: 'Draw a single closed loop along the grid lines that satisfies every number.',
      es: 'Dibuja un único bucle cerrado sobre las líneas de la cuadrícula que cumpla todos los números.',
    },
    rules: {
      en: ['The loop passes along the dotted grid lines, joining neighbouring dots.', 'Each number tells how many of the four sides of its cell belong to the loop.', 'The loop never crosses itself or branches, and it is one single loop.', 'Cells with no number can have any count of sides.'],
      es: ['El bucle recorre las líneas punteadas de la cuadrícula, uniendo puntos vecinos.', 'Cada número indica cuántos de los cuatro lados de su casilla pertenecen al bucle.', 'El bucle nunca se cruza ni se ramifica, y es un único bucle.', 'Las casillas sin número pueden tener cualquier cantidad de lados.'],
    },
    controls: {
      en: ['Tap a gap between two dots to cycle: line → ✕ → empty. ✕ marks a side you know is NOT in the loop.', 'Drag from dot to dot to draw several lines; a drag that starts on a line erases.'],
      es: ['Toca el hueco entre dos puntos para alternar: línea → ✕ → vacío. ✕ marca un lado que sabes que NO está en el bucle.', 'Arrastra de punto a punto para dibujar varias líneas; si empiezas sobre una línea, borra.'],
    },
    examples: [
      ex(undefined, '+---+\n| 4 |\n+---+', 'A “4” has all four sides in the loop. A “0” has none.', 'Un «4» tiene sus cuatro lados en el bucle. Un «0» no tiene ninguno.'),
      ex(undefined, '+---+   +\n| 3     0\n+---+   +', 'Next to a 0, the shared side is never drawn, so the 3 uses its other three sides.', 'Junto a un 0, el lado compartido nunca se dibuja, así que el 3 usa sus otros tres lados.'),
    ],
    tips: {
      en: ['Every dot has either 0 or 2 lines touching it. A dot with 2 ✕ already needs no more lines.', 'Two adjacent 3s share a line between them, and the lines extend outward from there.', 'The app highlights a number once it is satisfied, and flags it if it has too many lines.'],
      es: ['Cada punto tiene 0 o 2 líneas que lo tocan. Un punto con 2 ✕ ya no necesita más líneas.', 'Dos 3 adyacentes comparten la línea entre ellos, y las líneas se extienden hacia fuera.', 'La app resalta un número cuando se cumple y lo marca si tiene demasiadas líneas.'],
    },
  },

  minesweeper: {
    goal: {
      en: 'Open every cell that has no mine, using the numbers as clues.',
      es: 'Abre todas las casillas sin mina, usando los números como pistas.',
    },
    rules: {
      en: ['A number tells how many of the 8 neighbouring cells hide a mine.', 'Your first tap is always safe and opens an area. From there, every board can be solved by logic alone: you never have to guess.', 'Opening a mine ends the game, but you can retry the same board.', 'You win when all safe cells are open.'],
      es: ['Un número indica cuántas de las 8 casillas vecinas esconden una mina.', 'Tu primer toque siempre es seguro y abre una zona. A partir de ahí, todo tablero se resuelve solo con lógica: nunca hay que adivinar.', 'Abrir una mina termina la partida, pero puedes reintentar el mismo tablero.', 'Ganas cuando todas las casillas seguras están abiertas.'],
    },
    controls: {
      en: ['Tap to open a cell. Long-press (or pick the Flag tool) to flag a suspected mine.', 'Tap a number whose mines are all flagged to open the rest of its neighbours at once.'],
      es: ['Toca para abrir una casilla. Mantén pulsado (o elige la herramienta Bandera) para marcar una mina sospechosa.', 'Toca un número cuyas minas ya están todas marcadas para abrir de golpe el resto de sus vecinos.'],
    },
    examples: [
      ex(['1 1 .', '# 1 .'], undefined, 'The top-left 1 has only one hidden neighbour (#), so that cell is a mine. Flag it.', 'El 1 de arriba a la izquierda solo tiene un vecino oculto (#), así que esa casilla es una mina. Márcala con bandera.'),
    ],
    tips: {
      en: ['A 1 with only one hidden neighbour: that neighbour is a mine.', 'If a number’s mines are all flagged, every other neighbour is safe.', 'Compare neighbouring numbers: the difference between them often shows which cells hold the mines.'],
      es: ['Un 1 con un solo vecino oculto: ese vecino es una mina.', 'Si todas las minas de un número están marcadas, los demás vecinos son seguros.', 'Compara números vecinos: la diferencia entre ellos suele indicar dónde están las minas.'],
    },
  },

  tents: {
    goal: {
      en: 'Pitch a tent next to every tree without any two tents touching.',
      es: 'Planta una tienda junto a cada árbol sin que dos tiendas se toquen.',
    },
    rules: {
      en: ['Every tree has exactly one tent next to it (above, below, left or right), and every tent belongs to exactly one tree.', 'Tents never touch each other, not even diagonally.', 'The numbers outside the grid tell how many tents are in each row and column.'],
      es: ['Cada árbol tiene exactamente una tienda a su lado (arriba, abajo, izquierda o derecha), y cada tienda pertenece a un único árbol.', 'Las tiendas nunca se tocan, ni siquiera en diagonal.', 'Los números fuera de la cuadrícula indican cuántas tiendas hay en cada fila y columna.'],
    },
    controls: {
      en: ['Tap a square to cycle: tent → grass (a square you know has no tent) → empty.', 'Drag to apply the same mark to several squares. Numbers turn grey when satisfied and red when exceeded.'],
      es: ['Toca una casilla para alternar: tienda → hierba (una casilla que sabes sin tienda) → vacía.', 'Arrastra para aplicar la misma marca a varias casillas. Los números se ponen grises al cumplirse y rojos si se superan.'],
    },
    examples: [
      ex(['🌲 ⛺ .', '. . .', '. . .'], undefined, 'A tent is pitched right beside its tree.', 'Una tienda plantada justo al lado de su árbol.'),
      ex(['🌲 ⛺ .', '. 🌲 ⛺', '. . .'], undefined, 'Not allowed: the two tents touch diagonally.', 'No permitido: las dos tiendas se tocan en diagonal.'),
    ],
    tips: {
      en: ['A square with no tree beside it can never hold a tent: mark it as grass.', 'A tree with only one free neighbour must get its tent there.', 'When a tree has two possible squares that touch a common square, that common square is grass.', 'A row or column with a 0 is entirely grass; one whose count equals its free squares is entirely tents.'],
      es: ['Una casilla sin árbol al lado nunca puede tener tienda: márcala como hierba.', 'Un árbol con un solo vecino libre debe poner su tienda ahí.', 'Si un árbol tiene dos casillas posibles que tocan una casilla común, esa casilla común es hierba.', 'Una fila o columna con un 0 es toda hierba; si su número iguala sus casillas libres, son todas tiendas.'],
    },
  },

  lightup: {
    goal: {
      en: 'Light up every white square with bulbs, without letting bulbs shine on each other.',
      es: 'Ilumina todas las casillas blancas con bombillas, sin que las bombillas se iluminen entre sí.',
    },
    rules: {
      en: ['A bulb lights its own square and every square in its row and column until a black wall.', 'Every white square must be lit.', 'Two bulbs must never light each other.', 'A number on a wall says exactly how many bulbs are in the (up to four) squares touching it. Walls without a number can have any amount.'],
      es: ['Una bombilla ilumina su casilla y todas las de su fila y columna hasta un muro negro.', 'Todas las casillas blancas deben quedar iluminadas.', 'Dos bombillas nunca pueden iluminarse entre sí.', 'Un número en un muro indica exactamente cuántas bombillas hay en las (hasta cuatro) casillas que lo tocan. Los muros sin número pueden tener cualquier cantidad.'],
    },
    controls: {
      en: ['Tap a white square to cycle: bulb → dot (a square you know has no bulb) → empty.', 'Drag to apply the same mark to several squares. Lit squares turn yellow; bulbs that clash turn red.'],
      es: ['Toca una casilla blanca para alternar: bombilla → punto (una casilla que sabes sin bombilla) → vacía.', 'Arrastra para aplicar la misma marca a varias casillas. Las casillas iluminadas se ponen amarillas; las bombillas que chocan, rojas.'],
    },
    examples: [
      ex(['#0 . .', '. . .'], undefined, 'A 0 wall has no bulb beside it: its neighbours stay dark of bulbs.', 'Un muro 0 no tiene bombillas a su lado: sus vecinas quedan sin bombilla.'),
      ex(['#4 . #', '. #1 .', '# . #'], undefined, 'A 4 wall surrounded by white squares needs a bulb on all four sides.', 'Un muro 4 rodeado de casillas blancas necesita una bombilla en sus cuatro lados.'),
    ],
    tips: {
      en: ['A 4 needs all its neighbours; a 3 against the edge does too; a 0 rules out all of them.', 'If only one square can light a white square, put a bulb there.', 'A square already lit by a bulb can’t hold a bulb itself: mark it with a dot.'],
      es: ['Un 4 necesita todos sus vecinos; un 3 contra el borde también; un 0 los descarta todos.', 'Si solo una casilla puede iluminar una casilla blanca, pon la bombilla ahí.', 'Una casilla ya iluminada por una bombilla no puede tener bombilla: márcala con un punto.'],
    },
  },

  bridges: {
    goal: {
      en: 'Connect all the islands into one network with bridges.',
      es: 'Conecta todas las islas en una única red con puentes.',
    },
    rules: {
      en: ['Each island’s number is how many bridges end on it.', 'Bridges run in straight horizontal or vertical lines between two islands. Two islands can be joined by one or two bridges, never more.', 'Bridges never cross each other or pass over an island.', 'All islands must end up connected as one group.'],
      es: ['El número de cada isla indica cuántos puentes terminan en ella.', 'Los puentes van en línea recta, horizontal o vertical, entre dos islas. Dos islas pueden unirse con uno o dos puentes, nunca más.', 'Los puentes nunca se cruzan ni pasan por encima de una isla.', 'Todas las islas deben quedar conectadas en un único grupo.'],
    },
    controls: {
      en: ['Tap the dotted line between two islands to cycle: one bridge → two bridges → none.', 'Or drag from one island to a neighbouring one. Islands turn blue when complete and red if they have too many.'],
      es: ['Toca la línea de puntos entre dos islas para alternar: un puente → dos puentes → ninguno.', 'O arrastra de una isla a otra vecina. Las islas se ponen azules al completarse y rojas si tienen demasiados.'],
    },
    examples: [
      ex(undefined, '1──3══2', 'The 3 has a single bridge to the 1 and a double bridge to the 2.', 'El 3 tiene un puente simple al 1 y un puente doble al 2.'),
    ],
    tips: {
      en: ['An island whose number equals twice its possible neighbours (like a 4 with two neighbours) needs two bridges to each.', 'A 1 next to another 1 can’t join them unless those are the only two islands.', 'Always think about connectivity: a finished group with no way out is a dead end.'],
      es: ['Una isla cuyo número es el doble de sus vecinos posibles (como un 4 con dos vecinos) necesita dos puentes a cada uno.', 'Un 1 junto a otro 1 no puede unirlos salvo que sean las únicas dos islas.', 'Piensa siempre en la conectividad: un grupo terminado sin salida es un callejón sin salida.'],
    },
  },

  skyscrapers: {
    goal: {
      en: 'Place a building of height 1 to N in every square so that each clue counts the buildings visible from its edge.',
      es: 'Coloca un edificio de altura 1 a N en cada casilla para que cada pista cuente los edificios visibles desde su borde.',
    },
    rules: {
      en: ['Each row and each column holds the heights 1 to N exactly once.', 'A number outside the grid tells how many buildings you can see looking along that row or column from that side.', 'A taller building hides every shorter one behind it.'],
      es: ['Cada fila y cada columna contiene las alturas de 1 a N exactamente una vez.', 'Un número fuera de la cuadrícula indica cuántos edificios se ven mirando a lo largo de esa fila o columna desde ese lado.', 'Un edificio más alto oculta a todos los más bajos que tiene detrás.'],
    },
    controls: {
      en: ['Tap a square, then a number on the pad. Tap the same number again to clear it.', 'Notes lets you pencil in possible heights. Clues turn grey when their line is correct and red when it is not.'],
      es: ['Toca una casilla y luego un número del teclado. Toca el mismo número otra vez para borrarlo.', 'Notas permite anotar alturas posibles. Las pistas se ponen grises cuando su línea es correcta y rojas si no lo es.'],
    },
    examples: [
      ex(['#4 1 2 3 4', '#1 4 3 2 1'], undefined, 'From the left, the first row shows all four buildings (1 2 3 4 rises every step); the second shows just one, the 4, which hides the rest.', 'Desde la izquierda, la primera fila deja ver los cuatro edificios (1 2 3 4 sube en cada paso); la segunda solo uno, el 4, que oculta a los demás.'),
    ],
    tips: {
      en: ['A clue of 1 means the tallest building (N) is right next to the clue.', 'A clue of N means the heights ascend 1, 2, … N from that side.', 'With a clue of 2, the first building can’t be the tallest, otherwise you would see only one.'],
      es: ['Una pista de 1 significa que el edificio más alto (N) está justo junto a la pista.', 'Una pista de N significa que las alturas suben 1, 2, … N desde ese lado.', 'Con una pista de 2, el primer edificio no puede ser el más alto; si lo fuera solo verías uno.'],
    },
  },

  battleships: {
    goal: {
      en: 'Find where every ship of the fleet is hiding.',
      es: 'Encuentra dónde se esconde cada barco de la flota.',
    },
    rules: {
      en: ['The fleet is shown under the board: ships are straight lines of 1 to 4 squares.', 'Ships never touch each other, not even diagonally.', 'The numbers beside the grid tell how many squares of each row and column are part of a ship.', 'Some squares are already revealed: a round end, a middle piece, a single boat or open water.'],
      es: ['La flota se muestra bajo el tablero: los barcos son líneas rectas de 1 a 4 casillas.', 'Los barcos nunca se tocan, ni siquiera en diagonal.', 'Los números junto a la cuadrícula indican cuántas casillas de cada fila y columna son parte de un barco.', 'Algunas casillas ya están reveladas: un extremo, una pieza central, un barco suelto o agua.'],
    },
    controls: {
      en: ['Tap a square to cycle: water → ship → empty. Drag to apply the same mark to several squares.', 'Ships in the fleet list fade once you have drawn them and closed them in with water.'],
      es: ['Toca una casilla para alternar: agua → barco → vacía. Arrastra para aplicar la misma marca a varias casillas.', 'Los barcos de la lista de la flota se atenúan cuando los has dibujado y rodeado de agua.'],
    },
    examples: [
      ex(['~ ~ ~ ~', '~ ◖ ■ ◗', '~ ~ ~ ~'], undefined, 'A ship of three squares: both ends are rounded and everything around it is water.', 'Un barco de tres casillas: ambos extremos son redondeados y todo a su alrededor es agua.'),
    ],
    tips: {
      en: ['A row or column with a 0 is all water.', 'Around any ship square, the diagonal squares are water.', 'A rounded end tells you the ship continues the other way.', 'Count the squares left: the biggest ship can only go where there is enough room.'],
      es: ['Una fila o columna con un 0 es toda agua.', 'Alrededor de cualquier casilla de barco, las diagonales son agua.', 'Un extremo redondeado indica que el barco continúa hacia el otro lado.', 'Cuenta las casillas libres: el barco más grande solo cabe donde hay espacio suficiente.'],
    },
  },

  masyu: {
    goal: {
      en: 'Draw a single closed loop that passes through every pearl.',
      es: 'Dibuja un único bucle cerrado que pase por todas las perlas.',
    },
    rules: {
      en: ['The loop moves horizontally or vertically from cell centre to cell centre, never crossing or branching.', 'On a black pearl the loop must turn, and it must go straight for at least one more cell on both sides of the pearl.', 'On a white pearl the loop must go straight, and it must turn in at least one of the cells just before or after the pearl.', 'The loop doesn’t have to visit empty cells.'],
      es: ['El bucle se mueve en horizontal o vertical de centro a centro de casilla, sin cruzarse ni ramificarse.', 'En una perla negra el bucle debe girar, y debe seguir recto al menos una casilla más a ambos lados de la perla.', 'En una perla blanca el bucle debe ir recto, y debe girar en al menos una de las casillas justo antes o después de la perla.', 'El bucle no tiene que pasar por las casillas vacías.'],
    },
    controls: {
      en: ['Drag from cell to cell to draw the loop; a drag that starts on a line erases.', 'Tap the gap between two cells to cycle: line → ✕ (known empty) → clear.'],
      es: ['Arrastra de casilla en casilla para dibujar el bucle; si empiezas sobre una línea, borra.', 'Toca el hueco entre dos casillas para alternar: línea → ✕ (vacío seguro) → borrar.'],
    },
    examples: [
      ex(undefined, '●───┐\n│   │\n│   ○\n└───┘', 'The black pearl is a corner with straight runs on both sides; the white pearl is on a straight side, right before a corner.', 'La perla negra es una esquina con tramos rectos a ambos lados; la blanca está en un lado recto, justo antes de una esquina.'),
    ],
    tips: {
      en: ['Two black pearls next to each other, or a black pearl on the edge, restrict the loop a lot: start there.', 'A black pearl next to the border must turn away from it.', 'Three white pearls in a row can’t all go straight: at least one end must turn.', 'Mark edges you know are unused with ✕ to avoid dead ends and small loops.'],
      es: ['Dos perlas negras juntas, o una negra en el borde, limitan mucho el bucle: empieza por ahí.', 'Una perla negra junto al borde debe girar alejándose de él.', 'Tres perlas blancas seguidas no pueden ir todas rectas: al menos un extremo debe girar.', 'Marca con ✕ los tramos que sabes sin usar para evitar callejones sin salida y bucles pequeños.'],
    },
  },

  norinori: {
    goal: {
      en: 'Shade cells so that every region has exactly two shaded cells, forming dominoes.',
      es: 'Sombrea casillas para que cada región tenga exactamente dos casillas sombreadas, formando dominós.',
    },
    rules: {
      en: ['Every outlined region contains exactly two shaded cells.', 'Every shaded cell is part of exactly one domino: it touches exactly one other shaded cell, side by side.', 'A domino may stretch over two regions, and two dominoes never touch side by side (diagonals are fine).'],
      es: ['Cada región delimitada contiene exactamente dos casillas sombreadas.', 'Cada casilla sombreada forma parte de exactamente un dominó: toca por un lado exactamente a otra casilla sombreada.', 'Un dominó puede abarcar dos regiones, y dos dominós nunca se tocan por los lados (en diagonal sí).'],
    },
    controls: {
      en: ['Tap to cycle: shaded → dot (a cell you know is not shaded) → empty.', 'Drag to apply the same mark to several cells. Shaded cells in red break a rule.'],
      es: ['Toca para alternar: sombreada → punto (una casilla que sabes que no se sombrea) → vacía.', 'Arrastra para aplicar la misma marca a varias casillas. Las casillas sombreadas en rojo rompen una regla.'],
    },
    examples: [
      ex(['# # .', '. . .', '. . .'], undefined, 'A valid domino: two shaded cells side by side, touching nothing else shaded.', 'Un dominó válido: dos casillas sombreadas juntas que no tocan ninguna otra sombreada.'),
      ex(['# # #', '. . .', '. . .'], undefined, 'Not allowed: the middle cell touches two shaded cells.', 'No permitido: la casilla central toca dos casillas sombreadas.'),
    ],
    tips: {
      en: ['A region with only two cells is entirely shaded.', 'Cells next to a finished domino can’t be shaded: mark them with dots.', 'A lone cell with no free neighbour can never be shaded.'],
      es: ['Una región de solo dos casillas se sombrea entera.', 'Las casillas junto a un dominó terminado no pueden sombrearse: márcalas con puntos.', 'Una casilla sin ningún vecino libre nunca puede sombrearse.'],
    },
  },

  fillomino: {
    goal: {
      en: 'Write a number in every cell so that each group of touching equal numbers contains exactly that many cells.',
      es: 'Escribe un número en cada casilla para que cada grupo de números iguales conectados tenga exactamente esa cantidad de casillas.',
    },
    rules: {
      en: ['Every cell gets a number.', 'Cells with the same number that touch side by side form a group, and a group of N cells must carry the number N.', 'So a 1 is alone, a 2 is part of a pair, a 3 of a group of three, and so on.', 'Two different groups with the same number can’t touch.'],
      es: ['Cada casilla lleva un número.', 'Las casillas con el mismo número que se tocan por los lados forman un grupo, y un grupo de N casillas debe llevar el número N.', 'Así, un 1 está solo, un 2 forma pareja, un 3 es parte de un grupo de tres, y así sucesivamente.', 'Dos grupos distintos con el mismo número no pueden tocarse.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad. Tap the same number again to clear it.', 'Notes lets you pencil in candidates. Complete groups turn green; groups that are too big turn red.'],
      es: ['Toca una casilla y luego un número del teclado. Toca el mismo número otra vez para borrarlo.', 'Notas permite anotar candidatos. Los grupos completos se ponen verdes; los demasiado grandes, rojos.'],
    },
    examples: [
      ex(['*2 *2 3', '1 3 3'], undefined, 'The two 2s form a group of two, the three 3s a group of three, and the 1 stands alone.', 'Los dos 2 forman un grupo de dos, los tres 3 un grupo de tres y el 1 está solo.'),
    ],
    tips: {
      en: ['Start by surrounding 1s and completing the groups that are already the right size.', 'A given number with only one free neighbour must grow through that neighbour.', 'A cell that no group can reach with enough room can’t hold a large number.'],
      es: ['Empieza rodeando los 1 y completando los grupos que ya tienen el tamaño correcto.', 'Un número dado con un único vecino libre debe crecer por ese vecino.', 'Una casilla a la que ningún grupo puede llegar con espacio suficiente no puede tener un número grande.'],
    },
  },

  kuromasu: {
    goal: {
      en: 'Shade cells so that every number can see exactly that many unshaded cells.',
      es: 'Sombrea casillas para que cada número vea exactamente esa cantidad de casillas sin sombrear.',
    },
    rules: {
      en: ['A number counts the cells it sees, itself included, looking up, down, left and right until a shaded cell or the edge.', 'Numbered cells are never shaded.', 'Shaded cells can’t touch each other side by side.', 'All unshaded cells must stay connected as one area.'],
      es: ['Un número cuenta las casillas que ve, incluida la suya, mirando arriba, abajo, izquierda y derecha hasta una casilla sombreada o el borde.', 'Las casillas con número nunca se sombrean.', 'Las casillas sombreadas no pueden tocarse por los lados.', 'Todas las casillas sin sombrear deben seguir conectadas como una única zona.'],
    },
    controls: {
      en: ['Tap to cycle: shaded → dot (known unshaded) → empty. Drag to apply the same mark to several cells.', 'A number turns grey when it can’t change any more, and red when it can no longer be satisfied.'],
      es: ['Toca para alternar: sombreada → punto (seguro sin sombrear) → vacía. Arrastra para aplicar la misma marca a varias casillas.', 'Un número se pone gris cuando ya no puede cambiar, y rojo cuando ya no puede cumplirse.'],
    },
    examples: [
      ex(['*3 . #', '. . .', '# . .'], undefined, 'The 3 sees itself plus the cell to its right (the next one is shaded) and the cell below (the one after that is shaded): 1 + 1 + 1 = 3.', 'El 3 se ve a sí mismo, la casilla de su derecha (la siguiente está sombreada) y la de abajo (la siguiente está sombreada): 1 + 1 + 1 = 3.'),
    ],
    tips: {
      en: ['A 1 is surrounded by shaded cells (or the edge).', 'A number as large as its row and column allow sees everything: nothing near it can be shaded.', 'Neighbours of a shaded cell are unshaded; use dots to remember them.'],
      es: ['Un 1 está rodeado de casillas sombreadas (o el borde).', 'Un número tan grande como permiten su fila y columna lo ve todo: nada cerca de él puede sombrearse.', 'Los vecinos de una casilla sombreada no se sombrean; usa puntos para recordarlo.'],
    },
  },

  dominosa: {
    goal: {
      en: 'Cut the grid into dominoes so that every pair of numbers appears exactly once.',
      es: 'Divide la cuadrícula en dominós para que cada pareja de números aparezca exactamente una vez.',
    },
    rules: {
      en: ['The grid holds the numbers of a full set of dominoes, laid out in a jumble: a double-6 set has 28 dominoes, 0-0 up to 6-6.', 'Every cell belongs to exactly one domino (two neighbouring cells).', 'Each pair of numbers (for instance 2-5) is used exactly once; the list under the board shows which ones are still free.'],
      es: ['La cuadrícula contiene los números de un juego completo de dominó, mezclados: un juego doble 6 tiene 28 fichas, de 0-0 a 6-6.', 'Cada casilla pertenece exactamente a un dominó (dos casillas vecinas).', 'Cada pareja de números (por ejemplo 2-5) se usa exactamente una vez; la lista bajo el tablero muestra cuáles siguen libres.'],
    },
    controls: {
      en: ['Drag from a cell onto a neighbouring cell to place a domino there. Drag over an existing domino to lift it, or tap it.', 'Dominoes are coloured by their number pair: a pair used twice turns red, and used pairs fade in the list.'],
      es: ['Arrastra de una casilla a una vecina para colocar un dominó. Arrastra sobre un dominó existente para quitarlo, o tócalo.', 'Los dominós se colorean según su pareja de números: una pareja usada dos veces se pone roja, y las usadas se atenúan en la lista.'],
    },
    examples: [
      ex(['*0 *1 1 2'], undefined, 'Cells with 0 and 1 side by side can be the 0-1 domino. If another 0-1 pair shows up elsewhere, only one of them can be used.', 'Dos casillas con 0 y 1 juntas pueden ser el dominó 0-1. Si aparece otra pareja 0-1 en otro sitio, solo una puede usarse.'),
    ],
    tips: {
      en: ['A pair that appears only once on the board must be a domino right there.', 'Corner and edge cells have fewer neighbours: start with the ones that have a single option.', 'When a domino is placed, cross it off the list: its neighbours with the same pair can’t be dominoes.'],
      es: ['Una pareja que aparece una sola vez en el tablero debe ser un dominó justo ahí.', 'Las casillas de esquina y borde tienen menos vecinas: empieza por las que tienen una sola opción.', 'Al colocar un dominó, táchalo de la lista: las demás casillas con la misma pareja ya no pueden ser dominós.'],
    },
  },

  numberlink: {
    goal: {
      en: 'Connect every pair of equal numbers with a path, using every cell of the grid.',
      es: 'Conecta cada pareja de números iguales con un camino, usando todas las casillas de la cuadrícula.',
    },
    rules: {
      en: ['Each path joins two equal numbers and runs from cell to cell horizontally or vertically.', 'Paths never cross, branch or share cells.', 'Every cell of the grid must be on a path.'],
      es: ['Cada camino une dos números iguales y avanza de casilla en casilla en horizontal o vertical.', 'Los caminos nunca se cruzan, ramifican ni comparten casillas.', 'Todas las casillas de la cuadrícula deben estar en un camino.'],
    },
    controls: {
      en: ['Drag from a number (or from the end of its path) through the cells to paint the path in its colour.', 'Drag over cells to replace another path, or start on an empty cell to erase. Tap a path cell to clear it.', 'A number gets a glow ring once its pair is connected.'],
      es: ['Arrastra desde un número (o desde el final de su camino) por las casillas para pintar el camino de su color.', 'Arrastra sobre casillas para sustituir otro camino, o empieza en una casilla vacía para borrar. Toca una casilla del camino para borrarla.', 'Un número se rodea de un halo cuando su pareja está conectada.'],
    },
    examples: [
      ex(['*1 *1 .', '*2 . *2'], undefined, 'Two pairs: the 1s are neighbours; the 2s must go round to cover the remaining cells.', 'Dos parejas: los 1 son vecinos; los 2 deben rodear para cubrir las casillas restantes.'),
    ],
    tips: {
      en: ['A number in a corner has only two ways out; a cell with only one free neighbour is a dead end for the path.', 'Cells in a corridor of width one force the path along it.', 'Because every cell must be used, avoid leaving holes the path can’t reach.'],
      es: ['Un número en una esquina solo tiene dos salidas; una casilla con un solo vecino libre es un callejón sin salida.', 'Las casillas de un pasillo de ancho uno obligan al camino a recorrerlo.', 'Como hay que usar todas las casillas, evita dejar huecos a los que el camino no pueda llegar.'],
    },
  },

  thermometers: {
    goal: {
      en: 'Fill each thermometer with mercury from its bulb so every row and column has the right number of filled cells.',
      es: 'Llena cada termómetro de mercurio desde su bulbo para que cada fila y columna tenga la cantidad correcta de casillas llenas.',
    },
    rules: {
      en: ['Mercury starts at the round bulb and rises along the thermometer without gaps, as far as you like (or not at all).', 'The numbers beside the grid tell how many cells are filled in each row and column.', 'Every cell belongs to a thermometer.'],
      es: ['El mercurio parte del bulbo redondo y sube por el termómetro sin huecos, hasta donde quieras (o nada).', 'Los números junto a la cuadrícula indican cuántas casillas están llenas en cada fila y columna.', 'Cada casilla pertenece a un termómetro.'],
    },
    controls: {
      en: ['Tap a cell to cycle: filled → ✕ (known empty) → clear. Drag to apply the same mark to several cells.', 'Numbers turn grey when satisfied and red when exceeded.'],
      es: ['Toca una casilla para alternar: llena → ✕ (vacía segura) → borrar. Arrastra para aplicar la misma marca a varias casillas.', 'Los números se ponen grises al cumplirse y rojos si se superan.'],
    },
    examples: [
      ex(['*1 *1 .'], undefined, 'A thermometer of three cells filled up to its second cell: the bulb and the cell after it hold mercury.', 'Un termómetro de tres casillas lleno hasta la segunda: el bulbo y la casilla siguiente tienen mercurio.'),
    ],
    tips: {
      en: ['A filled cell forces everything between it and the bulb to be filled; an empty cell forces everything beyond it to be empty.', 'A row or column with 0 is empty; one whose count equals its length is full.', 'A tip cell far from the bulb can only be filled if the whole thermometer is.'],
      es: ['Una casilla llena obliga a llenar todo lo que hay entre ella y el bulbo; una vacía obliga a dejar vacío todo lo que hay más allá.', 'Una fila o columna con 0 está vacía; si su número iguala su longitud, está llena.', 'La punta lejos del bulbo solo puede llenarse si se llena todo el termómetro.'],
    },
  },

  mosaic: {
    goal: {
      en: 'Shade cells so that every number matches the shaded cells in its 3×3 neighbourhood, revealing a picture.',
      es: 'Sombrea casillas para que cada número coincida con las casillas sombreadas de su entorno 3×3, descubriendo una imagen.',
    },
    rules: {
      en: ['A number counts the shaded cells among the cell itself and its eight neighbours (fewer at the edges).', 'A 0 means all nine are unshaded; a 9 means all nine are shaded.', 'Cells without a number can be either; the numbers must all be satisfied.'],
      es: ['Un número cuenta las casillas sombreadas entre la propia casilla y sus ocho vecinas (menos en los bordes).', 'Un 0 significa que las nueve están sin sombrear; un 9, que las nueve están sombreadas.', 'Las casillas sin número pueden ser de cualquier tipo; todos los números deben cumplirse.'],
    },
    controls: {
      en: ['Tap to cycle: shaded → dot (known unshaded) → empty. Drag to apply the same mark to several cells.', 'A number turns grey when its block is fully decided and correct, and red when it can no longer be met.'],
      es: ['Toca para alternar: sombreada → punto (seguro sin sombrear) → vacía. Arrastra para aplicar la misma marca a varias casillas.', 'Un número se pone gris cuando su bloque está decidido y correcto, y rojo cuando ya no puede cumplirse.'],
    },
    examples: [
      ex(['*2 . .', '. . .', '. . .'], undefined, 'In a corner a block has only 4 cells, so a 2 there means exactly two of those four are shaded.', 'En una esquina un bloque solo tiene 4 casillas, así que un 2 ahí significa que exactamente dos de esas cuatro están sombreadas.'),
    ],
    tips: {
      en: ['Start with 0s and 9s (and 4s in corners, 6s on edges): they decide whole blocks.', 'Compare neighbouring numbers: the difference between two overlapping blocks lives in the cells they don’t share.', 'When a number is satisfied, mark its remaining cells as unshaded.'],
      es: ['Empieza por los 0 y 9 (y los 4 en esquinas, 6 en bordes): deciden bloques enteros.', 'Compara números vecinos: la diferencia entre dos bloques solapados está en las casillas que no comparten.', 'Cuando un número se cumple, marca sus casillas restantes como sin sombrear.'],
    },
  },

  jigsaw: {
    goal: {
      en: 'Fill the grid with digits so that every row, column and irregular region contains each digit once.',
      es: 'Rellena la cuadrícula con dígitos para que cada fila, columna y región irregular contenga cada dígito una vez.',
    },
    rules: {
      en: ['Each row and each column holds the digits 1 to N exactly once (N is the grid size).', 'Instead of square boxes, the grid is split into N irregular regions of N cells, marked by thick lines and soft colours. Each region also holds every digit exactly once.', 'The given digits are fixed.'],
      es: ['Cada fila y cada columna contiene los dígitos de 1 a N exactamente una vez (N es el tamaño de la cuadrícula).', 'En lugar de cajas cuadradas, la cuadrícula se divide en N regiones irregulares de N casillas, marcadas con líneas gruesas y colores suaves. Cada región también contiene cada dígito exactamente una vez.', 'Los dígitos dados son fijos.'],
    },
    controls: {
      en: ['Tap a cell, then a number on the pad. Tap the same number again to clear it.', 'Notes lets you pencil in candidates. Cells sharing a row, column or region with the selected one are highlighted; clashes turn red.'],
      es: ['Toca una casilla y luego un número del teclado. Toca el mismo número otra vez para borrarlo.', 'Notas permite anotar candidatos. Las casillas que comparten fila, columna o región con la seleccionada se resaltan; los choques se ponen rojos.'],
    },
    examples: [
      ex(['*1 *2 3 4', '3 *4 *3 2'], undefined, 'The highlighted L-shaped region holds 1, 2, 3 and 4 once each, just like a box would.', 'La región resaltada, con forma de L, contiene 1, 2, 3 y 4 una vez cada uno, igual que lo haría una caja.'),
    ],
    tips: {
      en: ['Look for a digit that can go in only one cell of a region, row or column.', 'If a digit in a region can only go in one row, it can’t go elsewhere in that row (and vice versa).', 'Odd-shaped regions often have a cell squeezed between others: start there.'],
      es: ['Busca un dígito que solo pueda ir en una casilla de una región, fila o columna.', 'Si un dígito de una región solo puede ir en una fila, no puede ir en otro lugar de esa fila (y al revés).', 'Las regiones de forma rara suelen tener una casilla encajada entre otras: empieza por ahí.'],
    },
  },
};

export function guideFor(id: string, lang: Lang): Guide | null {
  const g = RAW[id];
  if (!g) return null;
  return {
    goal: g.goal[lang],
    rules: g.rules[lang],
    controls: g.controls[lang],
    examples: g.examples.map((e) => e[lang]),
    tips: g.tips[lang],
  };
}
