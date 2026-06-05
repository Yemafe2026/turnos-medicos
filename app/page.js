import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow text-center space-y-4">
          <img
            src="/logo.png"
            alt="Laboral Salud"
            className="h-24 mx-auto object-contain"
          />

          <h1 className="text-3xl font-bold text-slate-800">
            Sistema de Turnos Médicos
          </h1>

          <p className="text-slate-600">
            Seleccione el tipo de trámite para solicitar su turno.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-slate-100 rounded-2xl p-6 shadow border border-slate-300 opacity-80 cursor-not-allowed">
            <h2 className="text-xl font-bold text-slate-700 mb-2">
              Licencia de Conducir Particular
            </h2>

            <p className="text-slate-500 text-sm">
              Turnos médicos para licencia de conducir particular.
            </p>

            <div className="mt-5 bg-slate-300 text-slate-600 rounded-xl p-3 text-center font-semibold">
              Temporalmente no disponible
            </div>
          </div>

          <Link
            href="/licencia-profesional"
            className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition border hover:border-orange-500"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Licencia de Conducir Profesional
            </h2>

            <p className="text-slate-600 text-sm">
              Turnos médicos para carnet profesional y certificaciones laborales.
            </p>

            <div className="mt-5 bg-orange-500 text-white rounded-xl p-3 text-center font-semibold">
              Solicitar turno profesional
            </div>
          </Link>
        </div>

        <div className="text-center text-xs text-slate-500">
          Laboral Salud · Gestión de Turnos Médicos
        </div>
      </div>
    </main>
  );
}