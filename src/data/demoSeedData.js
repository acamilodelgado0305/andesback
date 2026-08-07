// src/data/demoSeedData.js
//
// Contenido del "Instituto Demo QControla": lo que ve un interesado cuando
// entra al demo educativo. Está aparte del seeder a propósito — editar el
// catálogo de ejemplo (agregar una materia, mejorar un texto) no debería
// obligar a tocar la lógica de inserción.
//
// Regla al editar: nada de lorem ipsum. Un colegio que entra al demo tiene que
// reconocer su propia operación en estos datos, si no, no vende.

// ── Docentes ────────────────────────────────────────────────────────────────
export const DEMO_DOCENTES = [
  { key: 'marcela', nombre_completo: 'Marcela Ríos Peña', email: 'marcela.rios@institutodemo.edu.co', especialidad: 'Contabilidad y finanzas' },
  { key: 'julian', nombre_completo: 'Julián Ospina Cardona', email: 'julian.ospina@institutodemo.edu.co', especialidad: 'Sistemas e informática' },
  { key: 'carolina', nombre_completo: 'Carolina Restrepo Vélez', email: 'carolina.restrepo@institutodemo.edu.co', especialidad: 'Pedagogía infantil' },
  { key: 'andres', nombre_completo: 'Andrés Felipe Mora Salas', email: 'andres.mora@institutodemo.edu.co', especialidad: 'Seguridad y salud en el trabajo' },
  { key: 'luzdary', nombre_completo: 'Luz Dary Quintero Gómez', email: 'luz.quintero@institutodemo.edu.co', especialidad: 'Humanidades e inglés' },
];

// Helper para no repetir el mismo andamiaje HTML en cada clase.
const clase = (titulo, intro, puntos, cierre) => ({
  titulo,
  contenido: `
    <p>${intro}</p>
    <h3>En esta clase vas a ver</h3>
    <ul>${puntos.map((p) => `<li>${p}</li>`).join('')}</ul>
    <p>${cierre}</p>
  `.trim(),
});

// ── Programas → materias → temas → clases → evaluación ──────────────────────
export const DEMO_PROGRAMAS = [
  {
    key: 'administrativo',
    nombre: 'Técnico Laboral en Auxiliar Administrativo',
    tipo_programa: 'Tecnico',
    descripcion: 'Forma auxiliares capaces de gestionar la documentación, la caja menor y la atención al cliente de una pequeña empresa.',
    duracion_meses: 10,
    valor_matricula: 150000,
    valor_mensualidad: 180000,
    derechos_grado: 250000,
    intensidad_horaria: 880,
    cierres: ['Primer Corte', 'Segundo Corte', 'Corte Final'],
    materias: [
      {
        nombre: 'Fundamentos de Contabilidad',
        docente: 'marcela',
        temas: [
          {
            titulo: 'La ecuación contable',
            descripcion: 'Qué es el patrimonio y por qué activo siempre es igual a pasivo más patrimonio.',
            clases: [
              clase(
                'Clase 1 · Activo, pasivo y patrimonio',
                'Antes de registrar un solo peso hay que entender de dónde salió y a quién le pertenece. Esa es toda la contabilidad, resumida.',
                ['Qué cuenta como activo en un negocio real', 'Diferencia entre una deuda y una obligación con el dueño', 'Cómo se lee un balance de una tienda de barrio'],
                'Al terminar deberías poder clasificar cualquier partida de un negocio pequeño en una de las tres categorías.'
              ),
              clase(
                'Clase 2 · La partida doble en la práctica',
                'Toda operación toca al menos dos cuentas. Lo vamos a ver con las facturas de una papelería durante una semana.',
                ['Débito y crédito sin memorizar reglas', 'Registro de una venta de contado y una a crédito', 'Errores típicos que descuadran el libro'],
                'Ejercicio: registra las ocho operaciones del taller y verifica que el balance cuadre.'
              ),
            ],
          },
          {
            titulo: 'Documentos soporte y caja menor',
            descripcion: 'Facturas, recibos, comprobantes de egreso y el arqueo de caja del día.',
            clases: [
              clase(
                'Clase 1 · Qué documento pide cada operación',
                'La DIAN no acepta "se me perdió el recibo". Cada movimiento tiene su soporte y aquí vemos cuál.',
                ['Factura electrónica vs. documento equivalente', 'Comprobante de egreso y recibo de caja', 'Cuánto tiempo hay que archivar cada cosa'],
                'Vas a salir sabiendo qué exigirle a un proveedor antes de pagarle.'
              ),
              clase(
                'Clase 2 · Arqueo de caja menor',
                'El arqueo es el momento de la verdad: lo que dice el papel contra lo que hay en la caja.',
                ['Cómo se monta una caja menor y con cuánto', 'Formato de arqueo paso a paso', 'Qué hacer cuando falta o sobra plata'],
                'Práctica: haz el arqueo del caso del instituto y explica el faltante de $12.400.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Fundamentos de Contabilidad',
          descripcion: 'Diez minutos para verificar que la ecuación contable y los soportes quedaron claros.',
          tiempo_limite_min: 10,
          preguntas: [
            {
              enunciado: '¿Cuál es la ecuación contable básica?',
              opciones: [['Activo = Pasivo + Patrimonio', true], ['Activo = Ingresos - Gastos', false], ['Patrimonio = Activo + Pasivo', false], ['Pasivo = Activo + Patrimonio', false]],
            },
            {
              enunciado: 'Una deuda con un proveedor a 30 días se clasifica como:',
              opciones: [['Pasivo', true], ['Activo', false], ['Patrimonio', false], ['Ingreso', false]],
            },
            {
              enunciado: '¿Qué documento soporta la salida de dinero de la caja menor?',
              opciones: [['Comprobante de egreso', true], ['Recibo de caja', false], ['Cotización', false], ['Remisión', false]],
            },
            {
              enunciado: 'Si el arqueo muestra menos efectivo del que registra el libro, hay:',
              opciones: [['Un faltante que debe investigarse', true], ['Una utilidad del período', false], ['Un error que se corrige solo', false], ['Un sobrante de caja', false]],
            },
          ],
        },
      },
      {
        nombre: 'Ofimática y Herramientas Digitales',
        docente: 'julian',
        temas: [
          {
            titulo: 'Hojas de cálculo para la oficina',
            descripcion: 'De una tabla en blanco a un control de inventario que se actualiza solo.',
            clases: [
              clase(
                'Clase 1 · Fórmulas que sí se usan',
                'No necesitas cincuenta funciones. Con seis resuelves el 90% del trabajo administrativo.',
                ['SUMA, PROMEDIO y CONTAR.SI aplicados a una planilla real', 'Referencias absolutas: el signo $ explicado de una vez', 'BUSCARV para cruzar dos listas de clientes'],
                'Entregable: la planilla de gastos del mes, con totales automáticos.'
              ),
              clase(
                'Clase 2 · Tablas dinámicas en 20 minutos',
                'La tabla dinámica es la diferencia entre entregar 3.000 filas y entregar una respuesta.',
                ['Cuándo conviene una tabla dinámica', 'Agrupar ventas por mes y por vendedor', 'Gráfico dinámico para el informe de gerencia'],
                'Reto: responde con una sola tabla cuál fue el producto más vendido por sede.'
              ),
            ],
          },
          {
            titulo: 'Correo y agenda profesional',
            descripcion: 'Escribir para que respondan y organizar la agenda del jefe sin cruces.',
            clases: [
              clase(
                'Clase 1 · Redacción de correos institucionales',
                'Un correo mal escrito cuesta tres correos más. Vamos a escribir el primero bien.',
                ['Asunto que se entiende sin abrir el correo', 'Estructura: contexto, petición, plazo', 'Copia, copia oculta y cuándo usar cada una'],
                'Práctica: reescribe los tres correos del ejercicio y compáralos con el modelo.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Ofimática',
          descripcion: 'Verificación rápida de hojas de cálculo y comunicación escrita.',
          tiempo_limite_min: 10,
          preguntas: [
            {
              enunciado: '¿Qué función usarías para traer el precio de un producto desde otra hoja usando su código?',
              opciones: [['BUSCARV', true], ['CONTAR', false], ['PROMEDIO', false], ['CONCATENAR', false]],
            },
            {
              enunciado: 'El signo $ en la referencia $B$4 sirve para:',
              opciones: [['Fijar la celda al copiar la fórmula', true], ['Dar formato de moneda', false], ['Sumar la columna B', false], ['Convertir el texto en número', false]],
            },
            {
              enunciado: 'En un correo institucional, el asunto debe:',
              opciones: [['Resumir la petición concreta', true], ['Ir en blanco por formalidad', false], ['Ser lo más largo posible', false], ['Repetir el saludo', false]],
            },
            {
              enunciado: 'Una tabla dinámica sirve principalmente para:',
              opciones: [['Resumir y agrupar grandes volúmenes de datos', true], ['Cambiar los colores de la hoja', false], ['Proteger el archivo con contraseña', false], ['Imprimir en una sola página', false]],
            },
          ],
        },
      },
      {
        nombre: 'Servicio al Cliente y Comunicación',
        docente: 'luzdary',
        temas: [
          {
            titulo: 'Atención presencial y telefónica',
            descripcion: 'El primer minuto define si el cliente vuelve.',
            clases: [
              clase(
                'Clase 1 · El protocolo de atención',
                'Un protocolo no es un libreto rígido: es saber qué hacer cuando el cliente llega molesto.',
                ['Saludo, identificación y escucha activa', 'Cómo tomar un mensaje sin perder información', 'Qué prometer y qué no prometer nunca'],
                'Simulación en parejas: atiende el caso del pedido que llegó incompleto.'
              ),
              clase(
                'Clase 2 · Manejo de quejas y reclamos',
                'La queja bien atendida fideliza más que la venta sin problemas.',
                ['Separar el problema de la emoción', 'Radicar un PQRS y hacerle seguimiento', 'Cuándo escalar al superior'],
                'Entregable: respuesta escrita al reclamo del caso 3.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Servicio al Cliente',
          descripcion: 'Protocolo de atención y manejo de reclamos.',
          tiempo_limite_min: 8,
          preguntas: [
            {
              enunciado: 'Ante un cliente molesto, el primer paso es:',
              opciones: [['Escuchar sin interrumpir y confirmar que entendiste', true], ['Explicar por qué la empresa tiene la razón', false], ['Pasarlo de inmediato a otra área', false], ['Pedirle que baje la voz', false]],
            },
            {
              enunciado: 'PQRS significa:',
              opciones: [['Peticiones, Quejas, Reclamos y Sugerencias', true], ['Plan de Quejas y Respuestas del Servicio', false], ['Protocolo de Queja Rápida y Segura', false], ['Proceso de Calidad y Revisión de Servicio', false]],
            },
            {
              enunciado: 'Al tomar un mensaje telefónico NO puede faltar:',
              opciones: [['Quién llama, para quién y cómo devolver la llamada', true], ['La opinión de quien contesta', false], ['La duración exacta de la llamada', false], ['El clima del día', false]],
            },
          ],
        },
      },
    ],
  },

  {
    key: 'primera_infancia',
    nombre: 'Técnico Laboral en Atención a la Primera Infancia',
    tipo_programa: 'Tecnico',
    descripcion: 'Prepara auxiliares para acompañar el desarrollo de niños de 0 a 6 años en jardines y hogares comunitarios.',
    duracion_meses: 12,
    valor_matricula: 150000,
    valor_mensualidad: 170000,
    derechos_grado: 250000,
    intensidad_horaria: 960,
    cierres: ['Primer Corte', 'Segundo Corte', 'Corte Final'],
    materias: [
      {
        nombre: 'Desarrollo Infantil',
        docente: 'carolina',
        temas: [
          {
            titulo: 'Hitos del desarrollo de 0 a 3 años',
            descripcion: 'Qué se espera a cada edad y cuándo hay que remitir a un especialista.',
            clases: [
              clase(
                'Clase 1 · Desarrollo motor y del lenguaje',
                'Cada niño va a su ritmo, pero hay rangos. Conocerlos es lo que permite detectar a tiempo.',
                ['Hitos motores mes a mes hasta los 3 años', 'Primeras palabras y explosión del vocabulario', 'Señales de alarma que exigen remisión'],
                'Actividad: ubica los cinco casos del taller en la tabla de hitos.'
              ),
              clase(
                'Clase 2 · Apego y desarrollo socioemocional',
                'La forma en que un niño se despide de su mamá en la puerta dice mucho de su desarrollo.',
                ['Tipos de apego y cómo se ven en el jardín', 'La adaptación de los primeros días', 'Acompañar una rabieta sin castigar la emoción'],
                'Reflexión escrita: ¿qué harías con el caso de Samuel, que llora toda la jornada?'
              ),
            ],
          },
          {
            titulo: 'Juego y aprendizaje',
            descripcion: 'El juego no es el recreo: es el método.',
            clases: [
              clase(
                'Clase 1 · Planear una actividad rectora',
                'Vamos a diseñar una actividad completa, con propósito, materiales y evaluación.',
                ['Las cuatro actividades rectoras', 'De la intención pedagógica a la actividad concreta', 'Materiales de bajo costo que sí funcionan'],
                'Entregable: la planeación de una actividad de exploración del medio.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Desarrollo Infantil',
          descripcion: 'Hitos, apego y juego.',
          tiempo_limite_min: 10,
          preguntas: [
            {
              enunciado: 'Las actividades rectoras de la primera infancia son:',
              opciones: [['Juego, arte, literatura y exploración del medio', true], ['Lectura, escritura, matemáticas y ciencias', false], ['Motricidad, lenguaje, música y deporte', false], ['Higiene, alimentación, sueño y juego', false]],
            },
            {
              enunciado: 'Un niño de 12 meses que aún no se sienta sin apoyo:',
              opciones: [['Debe remitirse para valoración', true], ['Está dentro de lo esperado', false], ['Solo necesita más tiempo boca abajo', false], ['Es normal si camina', false]],
            },
            {
              enunciado: 'Ante una rabieta, la respuesta adecuada es:',
              opciones: [['Acompañar y poner límites con calma', true], ['Ignorar al niño toda la jornada', false], ['Castigarlo frente al grupo', false], ['Darle lo que pide para que pare', false]],
            },
          ],
        },
      },
      {
        nombre: 'Cuidado, Nutrición y Primeros Auxilios',
        docente: 'andres',
        temas: [
          {
            titulo: 'Seguridad y primeros auxilios',
            descripcion: 'Lo que hay que saber hacer en los primeros tres minutos.',
            clases: [
              clase(
                'Clase 1 · Atragantamiento y heridas leves',
                'Es la emergencia más frecuente en jardines y la que menos margen de duda permite.',
                ['Maniobra para lactantes y para niños mayores de un año', 'Limpieza y cubrimiento de una herida', 'Qué NO hacer nunca (y por qué)'],
                'Práctica con maniquí y registro en el formato de novedades.'
              ),
              clase(
                'Clase 2 · Minuta nutricional y alergias',
                'Una minuta mal armada es un problema de salud pública en miniatura.',
                ['Cómo leer una minuta patrón', 'Registro y manejo de alergias alimentarias', 'Manipulación de alimentos: lo mínimo legal'],
                'Entregable: revisa la minuta de la semana y señala los dos errores.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Cuidado y Primeros Auxilios',
          descripcion: 'Emergencias frecuentes y manejo de alimentos.',
          tiempo_limite_min: 8,
          preguntas: [
            {
              enunciado: 'Ante un lactante que se atraganta y no puede toser, se debe:',
              opciones: [['Aplicar golpes interescapulares y compresiones torácicas', true], ['Darle agua inmediatamente', false], ['Meterle los dedos en la boca', false], ['Esperar a que pase solo', false]],
            },
            {
              enunciado: 'La información de alergias alimentarias de cada niño debe:',
              opciones: [['Estar registrada y visible para el personal de cocina', true], ['Guardarse solo en la carpeta de matrícula', false], ['Comunicarse verbalmente una vez al año', false], ['Manejarla únicamente el acudiente', false]],
            },
            {
              enunciado: 'Ante una herida leve, el primer paso es:',
              opciones: [['Lavarse las manos y limpiar la herida con agua y jabón', true], ['Aplicar alcohol directamente', false], ['Cubrirla sin limpiar', false], ['Aplicar hielo en la herida abierta', false]],
            },
          ],
        },
      },
    ],
  },

  {
    key: 'validacion',
    nombre: 'Validación de Bachillerato',
    tipo_programa: 'Validacion',
    descripcion: 'Programa flexible para adultos que necesitan terminar el bachillerato y presentar las pruebas de Estado.',
    duracion_meses: 6,
    valor_matricula: 90000,
    valor_mensualidad: 120000,
    derechos_grado: 200000,
    intensidad_horaria: 480,
    cierres: ['Primer Corte', 'Segundo Corte', 'Corte Final'],
    materias: [
      {
        nombre: 'Matemáticas',
        docente: 'julian',
        temas: [
          {
            titulo: 'Razones, proporciones y porcentajes',
            descripcion: 'El bloque que más pesa en la prueba y el que más se usa en la vida.',
            clases: [
              clase(
                'Clase 1 · Regla de tres y porcentajes',
                'Si sabes calcular un descuento y un incremento, ya resolviste media prueba de razonamiento cuantitativo.',
                ['Regla de tres directa e inversa con casos de mercado', 'Aumento y descuento sucesivo (por qué 20% + 20% no es 40%)', 'Interpretar una tabla de precios'],
                'Taller: los 12 ejercicios de la guía, con procedimiento.'
              ),
              clase(
                'Clase 2 · Lectura de gráficos estadísticos',
                'La prueba no pide calcular: pide leer bien.',
                ['Barras, líneas y tortas: qué muestra cada una', 'Media, mediana y moda sin fórmulas complicadas', 'Trampas visuales frecuentes en los gráficos'],
                'Práctica: responde las seis preguntas del gráfico de desempleo.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Matemáticas',
          descripcion: 'Proporcionalidad y lectura de gráficos.',
          tiempo_limite_min: 15,
          preguntas: [
            {
              enunciado: 'Un producto de $50.000 tiene 20% de descuento. ¿Cuánto se paga?',
              opciones: [['$40.000', true], ['$30.000', false], ['$45.000', false], ['$60.000', false]],
            },
            {
              enunciado: 'Si 4 operarios hacen un trabajo en 6 días, ¿cuántos días tardan 8 operarios?',
              opciones: [['3 días', true], ['12 días', false], ['6 días', false], ['2 días', false]],
            },
            {
              enunciado: 'La mediana de 3, 7, 9, 12 y 20 es:',
              opciones: [['9', true], ['7', false], ['10.2', false], ['12', false]],
            },
            {
              enunciado: 'Un gráfico de torta sirve para mostrar:',
              opciones: [['La participación de cada parte en un total', true], ['La evolución en el tiempo', false], ['La correlación entre dos variables', false], ['La dispersión de los datos', false]],
            },
          ],
        },
      },
      {
        nombre: 'Lengua Castellana',
        docente: 'luzdary',
        temas: [
          {
            titulo: 'Comprensión lectora',
            descripcion: 'Leer para responder, no para recordar.',
            clases: [
              clase(
                'Clase 1 · Idea principal y propósito del autor',
                'Casi todas las preguntas de lectura crítica son una de estas dos.',
                ['Distinguir tema, idea principal e idea secundaria', 'Detectar la intención: informar, persuadir, narrar', 'Estrategia de lectura para textos largos con tiempo limitado'],
                'Práctica: los dos textos de la guía, cronometrados.'
              ),
              clase(
                'Clase 2 · Argumentación y falacias',
                'Reconocer un argumento tramposo también se evalúa.',
                ['Premisa, conclusión y supuesto', 'Falacias más frecuentes en publicidad y política', 'Cómo se construye un párrafo argumentativo'],
                'Entregable: párrafo argumentativo de 150 palabras sobre el tema asignado.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Lengua Castellana',
          descripcion: 'Comprensión lectora y argumentación.',
          tiempo_limite_min: 12,
          preguntas: [
            {
              enunciado: 'La idea principal de un texto es:',
              opciones: [['Aquello que el texto sostiene y el resto sustenta', true], ['La primera oración del texto', false], ['La palabra que más se repite', false], ['La opinión del lector', false]],
            },
            {
              enunciado: 'Un texto que busca convencer al lector es principalmente:',
              opciones: [['Argumentativo', true], ['Narrativo', false], ['Descriptivo', false], ['Instructivo', false]],
            },
            {
              enunciado: 'En un argumento, la premisa es:',
              opciones: [['La razón que sostiene la conclusión', true], ['La conclusión misma', false], ['Un ejemplo decorativo', false], ['El título del texto', false]],
            },
          ],
        },
      },
      {
        nombre: 'Ciencias Naturales',
        docente: 'andres',
        temas: [
          {
            titulo: 'El cuerpo humano y la salud',
            descripcion: 'Sistemas del cuerpo con enfoque en decisiones cotidianas de salud.',
            clases: [
              clase(
                'Clase 1 · Sistemas circulatorio y respiratorio',
                'Dos sistemas que trabajan juntos y que explican por qué el ejercicio cansa menos con el tiempo.',
                ['Recorrido de la sangre y función del oxígeno', 'Qué mide realmente la presión arterial', 'Efecto del cigarrillo, explicado con el intercambio gaseoso'],
                'Actividad: rotula el diagrama y explica el circuito menor.'
              ),
            ],
          },
        ],
        evaluacion: {
          titulo: 'Quiz · Ciencias Naturales',
          descripcion: 'Circulación, respiración y salud.',
          tiempo_limite_min: 10,
          preguntas: [
            {
              enunciado: 'El intercambio de oxígeno y dióxido de carbono ocurre en:',
              opciones: [['Los alvéolos pulmonares', true], ['El estómago', false], ['Los riñones', false], ['La tráquea', false]],
            },
            {
              enunciado: 'La sangre sale del corazón hacia el cuerpo por:',
              opciones: [['Las arterias', true], ['Las venas', false], ['Los capilares linfáticos', false], ['Los bronquios', false]],
            },
            {
              enunciado: 'La presión arterial alta sostenida aumenta el riesgo de:',
              opciones: [['Infarto y accidente cerebrovascular', true], ['Miopía', false], ['Fracturas óseas', false], ['Alergias estacionales', false]],
            },
          ],
        },
      },
    ],
  },
];

// ── Estudiantes ─────────────────────────────────────────────────────────────
// `programa` apunta al `key` del programa. Los datos son ficticios pero con la
// forma real de una matrícula colombiana (documento, EPS, RH, acudiente).
export const DEMO_ESTUDIANTES = [
  { nombre: 'Valentina', apellido: 'Osorio Betancur', tipo_documento: 'CC', numero_documento: '1032456789', telefono: '3105678901', programa: 'administrativo', matriculado: true, eps: 'Sura', rh: 'O+', ciudad: 'Medellín' },
  { nombre: 'Santiago', apellido: 'Cárdenas Ruiz', tipo_documento: 'CC', numero_documento: '1015234876', telefono: '3124589076', programa: 'administrativo', matriculado: true, eps: 'Nueva EPS', rh: 'A+', ciudad: 'Bogotá' },
  { nombre: 'Laura Sofía', apellido: 'Mendoza Parra', tipo_documento: 'TI', numero_documento: '1098765432', telefono: '3201234567', programa: 'administrativo', matriculado: true, eps: 'Salud Total', rh: 'O-', ciudad: 'Bucaramanga', acudiente: 'Nubia Parra Díaz' },
  { nombre: 'Juan Esteban', apellido: 'Gaviria Londoño', tipo_documento: 'CC', numero_documento: '1042398765', telefono: '3117654321', programa: 'administrativo', matriculado: false, eps: 'Sanitas', rh: 'B+', ciudad: 'Pereira' },
  { nombre: 'Daniela', apellido: 'Herrera Piedrahíta', tipo_documento: 'CC', numero_documento: '1053874219', telefono: '3145098231', programa: 'administrativo', matriculado: true, eps: 'Coosalud', rh: 'A-', ciudad: 'Manizales' },
  { nombre: 'Camilo Andrés', apellido: 'Zapata Muñoz', tipo_documento: 'CC', numero_documento: '1027654312', telefono: '3178452190', programa: 'administrativo', matriculado: true, eps: 'Sura', rh: 'O+', ciudad: 'Envigado' },

  { nombre: 'Mariana', apellido: 'Quintero Salazar', tipo_documento: 'CC', numero_documento: '1067341289', telefono: '3134567812', programa: 'primera_infancia', matriculado: true, eps: 'Nueva EPS', rh: 'AB+', ciudad: 'Cali' },
  { nombre: 'Yeimy Paola', apellido: 'Arévalo Cortés', tipo_documento: 'CC', numero_documento: '1019873456', telefono: '3216549870', programa: 'primera_infancia', matriculado: true, eps: 'Famisanar', rh: 'O+', ciudad: 'Soacha' },
  { nombre: 'Kevin Alejandro', apellido: 'Torres Bedoya', tipo_documento: 'CC', numero_documento: '1088234567', telefono: '3009876543', programa: 'primera_infancia', matriculado: false, eps: 'Salud Total', rh: 'B-', ciudad: 'Ibagué' },
  { nombre: 'Angie Carolina', apellido: 'Pulido Ramírez', tipo_documento: 'TI', numero_documento: '1104556677', telefono: '3167788990', programa: 'primera_infancia', matriculado: true, eps: 'Sanitas', rh: 'A+', ciudad: 'Villavicencio', acudiente: 'Marta Ramírez León' },
  { nombre: 'Estefanía', apellido: 'Naranjo Cifuentes', tipo_documento: 'CC', numero_documento: '1076554433', telefono: '3182345678', programa: 'primera_infancia', matriculado: true, eps: 'Sura', rh: 'O+', ciudad: 'Armenia' },
  { nombre: 'Brayan Steven', apellido: 'Ocampo Giraldo', tipo_documento: 'CC', numero_documento: '1093322110', telefono: '3151122334', programa: 'primera_infancia', matriculado: true, eps: 'Coomeva', rh: 'A+', ciudad: 'Dosquebradas' },

  { nombre: 'Rosa Elena', apellido: 'Cuervo Ballesteros', tipo_documento: 'CC', numero_documento: '52487693', telefono: '3123344556', programa: 'validacion', matriculado: true, eps: 'Nueva EPS', rh: 'O+', ciudad: 'Bogotá' },
  { nombre: 'Wilson', apellido: 'Trujillo Amaya', tipo_documento: 'CC', numero_documento: '79654321', telefono: '3106677889', programa: 'validacion', matriculado: true, eps: 'Capital Salud', rh: 'B+', ciudad: 'Bogotá' },
  { nombre: 'Yuliana Andrea', apellido: 'Sepúlveda Marín', tipo_documento: 'CC', numero_documento: '1035667788', telefono: '3199988776', programa: 'validacion', matriculado: true, eps: 'Sura', rh: 'A+', ciudad: 'Bello' },
  { nombre: 'Óscar Iván', apellido: 'Bermúdez Fonseca', tipo_documento: 'CC', numero_documento: '80332211', telefono: '3112233445', programa: 'validacion', matriculado: false, eps: 'Compensar', rh: 'O-', ciudad: 'Chía' },
  { nombre: 'Nataly', apellido: 'Cuesta Mosquera', tipo_documento: 'CC', numero_documento: '1128445566', telefono: '3206677445', programa: 'validacion', matriculado: true, eps: 'Asmet Salud', rh: 'AB-', ciudad: 'Quibdó' },
  { nombre: 'Héctor Fabio', apellido: 'Lozano Sierra', tipo_documento: 'CC', numero_documento: '94556677', telefono: '3187766554', programa: 'validacion', matriculado: true, eps: 'Emssanar', rh: 'B+', ciudad: 'Palmira' },
];

// ── Mensajes del foro de la primera materia ────────────────────────────────
// Un foro con cero mensajes parece una función rota; con tres, se entiende.
// autor_tipo debe ser uno de: 'admin' | 'docente' | 'estudiante'.
export const DEMO_FORO = [
  { autor_tipo: 'estudiante', autor: 'Valentina Osorio Betancur', mensaje: 'Profe, ¿el taller de la clase 2 se entrega en el mismo archivo del arqueo o aparte?' },
  { autor_tipo: 'docente', autor: 'Marcela Ríos Peña', mensaje: 'En el mismo archivo, Valentina. Usen una hoja por ejercicio y me lo suben antes del viernes.' },
  { autor_tipo: 'estudiante', autor: 'Santiago Cárdenas Ruiz', mensaje: 'Quedé con dudas en el faltante de los $12.400. ¿Podemos verlo al inicio de la próxima clase?' },
];
