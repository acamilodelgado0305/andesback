// src/utils/correoDocumentos.js
//
// Maqueta HTML del correo con el que se entregan los documentos al estudiante
// (certificado + carnet de manipulación de alimentos, diploma + certificado de
// Alianza Capacitarte, y lo que venga después).
//
// Es UNA sola maqueta parametrizada: cada plantilla de documentos le pasa su
// título, su introducción, la lista de adjuntos y las filas del detalle. Así
// todos los envíos se ven iguales y solo cambia el texto; antes el HTML vivía
// dentro del controlador de alimentos con el curso escrito a mano, y no se podía
// reutilizar para otro curso.

/**
 * Tarjeta de un documento adjunto dentro del correo.
 * @param {{icono: string, titulo: string, detalle: string}} doc
 */
const tarjetaDocumento = ({ icono, titulo, detalle }) => `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px; line-height: 1;">${icono}</span>
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">${titulo}</h4>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">${detalle}</p>
                </div>
            </div>
        `;

// Fila de la tabla "Detalles del Registro".
// El ancho de la columna de etiquetas se declara SOLO en la primera fila (es lo
// que fija el reparto de la tabla) y la última fila va sin borde inferior, que
// ya lo pone el borde de la tabla.
const filaDetalle = ({ label, valor }, esPrimera, esUltima) => {
    const borde = esUltima ? '' : 'border-bottom:1px solid #e2e8f0;';
    const ancho = esPrimera ? 'width:35%;' : '';
    return `
                    <tr>
                      <td style="padding:14px 16px;${borde}font-size:13px;color:#64748b;${ancho}"><strong>${label}:</strong></td>
                      <td style="padding:14px 16px;${borde}font-size:13px;color:#1e293b;">${valor}</td>
                    </tr>`;
};

/**
 * Arma el HTML completo del correo.
 *
 * @param {Object} opts
 * @param {string} opts.nombre        - Nombre del estudiante (encabeza el saludo).
 * @param {string} opts.titulo        - Título del banner (normalmente el curso).
 * @param {string} [opts.subtitulo]   - Línea pequeña bajo el título.
 * @param {string} opts.introduccion  - Primer párrafo. Admite HTML.
 * @param {Array<{icono:string,titulo:string,detalle:string}>} opts.documentos - Adjuntos que se listan.
 * @param {Array<{label:string,valor:string}>} opts.detalles - Filas de la tabla de registro.
 * @param {string} [opts.nota]        - Nota en cursiva al pie del cuerpo.
 */
export const plantillaCorreoDocumentos = ({
    nombre,
    titulo,
    subtitulo = 'Acreditación y Documentos Oficiales',
    introduccion,
    documentos = [],
    detalles = [],
    nota = '* Los documentos cuentan con firma digital y un código QR de autenticidad verificable.',
}) => `
    <div style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
              <!-- Cabecera Corporativa -->
              <tr>
                <td style="background-color:#155153;padding:32px;text-align:center;border-bottom:4px solid #c5a059;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;">
                    ${titulo}
                  </h1>
                  <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
                    ${subtitulo}
                  </p>
                </td>
              </tr>
              <!-- Contenido -->
              <tr>
                <td style="padding:40px 32px 32px 32px;">
                  <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
                    Hola ${nombre},
                  </h2>
                  <p style="margin:0 0 24px;color:#334155;font-size:14px;line-height:1.6;">
                    ${introduccion}
                  </p>

                  <!-- Lista de Documentos -->
                  <div style="margin-bottom:24px;">
                    ${documentos.map(tarjetaDocumento).join('')}
                  </div>

                  <!-- Detalle de Acreditación -->
                  <h3 style="margin:0 0 12px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                    Detalles del Registro:
                  </h3>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#f8fafc;">${detalles
        .map((d, i) => filaDetalle(d, i === 0, i === detalles.length - 1))
        .join('')}
                  </table>

                  <p style="margin:0 0 8px;color:#334155;font-size:13px;line-height:1.6;">
                    Te recomendamos descargar y almacenar estos archivos para tu uso oficial.
                  </p>
                  <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;font-style:italic;">
                    ${nota}
                  </p>
                </td>
              </tr>
              <!-- Firma y Despedida -->
              <tr>
                <td style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0;color:#94a3b8;font-size:10px;line-height:1.4;">
                    Este es un correo de notificación automática. Por favor no respondas a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    `;

export default plantillaCorreoDocumentos;
