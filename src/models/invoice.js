const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const invoiceSchema = mongoose.Schema(
  {
    id: { type: String, default: uuidv4, unique: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    fecha: { type: Date, default: Date.now },
    monto: { type: Number, required: true },
    descripcion: { type: String, required: true }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
