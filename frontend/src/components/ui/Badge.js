const COLORS = {
  ativo: 'bg-sage/15 text-sage',
  concluida: 'bg-sage/15 text-sage',
  pago: 'bg-sage/15 text-sage',
  pendente: 'bg-gold/15 text-gold',
  parcial: 'bg-gold/15 text-gold',
  vencido: 'bg-bordeaux/15 text-bordeaux',
  cancelada: 'bg-mist/15 text-mist',
  cancelado: 'bg-mist/15 text-mist',
  inativo: 'bg-mist/15 text-mist',
};

export default function Badge({ status }) {
  const cls = COLORS[status] || 'bg-mist/15 text-mist';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>{status}</span>;
}
