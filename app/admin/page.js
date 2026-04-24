export default function AdminPage() {
  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Panel Administración</h1>
      <p>Desde aquí recepción gestionará turnos pendientes y confirmaciones.</p>

      <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "10px" }}>
        <p><strong>Paciente:</strong> Juan Pérez</p>
        <p><strong>DNI:</strong> 30111222</p>
        <p><strong>Fecha:</strong> 2026-04-25</p>
        <p><strong>Hora:</strong> 09:20</p>
        <p><strong>Estado:</strong> Pendiente</p>

        <button>
          Confirmar manualmente
        </button>
      </div>
    </main>
  );
}
