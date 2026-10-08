// src/controllers/verificacionController.js
//
// Endpoints PÚBLICOS que usa la página de verificación de Alianza Capacitarte
// (alianzacapacitarte.com/verificacion.html) para validar los documentos que
// emite el sistema: por el código impreso debajo del QR o por número de documento.

import {
    buscarPorCodigo,
    buscarPorNumeroDocumento,
    normalizarCodigo,
} from '../services/documentosEmitidos.js';

// GET /api/verificar-documento/:codigo
export const verificarPorCodigo = async (req, res) => {
    const codigo = normalizarCodigo(req.params.codigo);
    if (!codigo) {
        return res.status(400).json({ error: 'El código debe tener 8 caracteres (ej. 7K3M-9Q2X).' });
    }

    try {
        const documento = await buscarPorCodigo(codigo);
        if (!documento) return res.status(404).json({ error: 'No existe un documento con ese código.' });
        res.json(documento);
    } catch (err) {
        console.error('Error verificando documento por código:', err);
        res.status(500).json({ error: 'Error interno al verificar el documento.' });
    }
};

// GET /api/verificar-documento?documento=123456
export const verificarPorNumeroDocumento = async (req, res) => {
    const numero = String(req.query.documento || '').replace(/\D/g, '');
    if (numero.length < 5) {
        return res.status(400).json({ error: 'Número de documento inválido.' });
    }

    try {
        res.json(await buscarPorNumeroDocumento(numero));
    } catch (err) {
        console.error('Error verificando documentos por número de documento:', err);
        res.status(500).json({ error: 'Error interno al verificar los documentos.' });
    }
};
