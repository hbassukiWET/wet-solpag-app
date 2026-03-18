export type Empresa = 'WET' | 'WEST' | 'VCC' | 'ALDM' | 'ITR';
export type Moneda = 'MXN' | 'USD' | 'EUR';

export interface PaymentRequest {
  numSP: string;
  empresa: Empresa;
  ordenCompra: string;
  fechaSolicitud: Date;
  fechaPagoTentativa: Date;
  transferenciaNombre: string;
  moneda: Moneda;
  cuentaBanco: string;
  conceptoPago: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  comentarios?: string;
  documentoAdjunto?: File;
  overwrite?: boolean;
}

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}
