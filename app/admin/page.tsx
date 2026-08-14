"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ShoppingBag,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface Venta {
  id: number;
  created_at: string;
  mesa_id: number;
  numero_mesa: number;
  metodo_pago: string;
  subtotal: number;
  descuento: number;
  total: number;
  items_detalle: { nombre: string; cantidad: number; precio: number }[];
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  disponible: boolean;
}

export default function AdminDashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("ventas").select("*").order("created_at", { ascending: false });
      const { data: pData } = await supabase.from("productos").select("*").order("stock", { ascending: true });

      if (vData) setVentas(vData as Venta[]);
      if (pData) setProductos(pData as Producto[]);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Agrupar ventas por fecha (AAAA-MM-DD)
  const ventasPorDia = useMemo(() => {
    const grupos: Record<string, Venta[]> = {};
    ventas.forEach((v) => {
      const fecha = new Date(v.created_at).toISOString().split("T")[0];
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(v);
    });
    return grupos;
  }, [ventas]);

  const toggleFolder = (fecha: string) => {
    setOpenFolders((prev) => ({ ...prev, [fecha]: !prev[fecha] }));
  };

  // Métricas
  const totalIngresos = useMemo(() => ventas.reduce((acc, v) => acc + (v.total || 0), 0), [ventas]);
  const totalDescuentos = useMemo(() => ventas.reduce((acc, v) => acc + (v.descuento || 0), 0), [ventas]);
  const ticketPromedio = useMemo(() => (ventas.length > 0 ? totalIngresos / ventas.length : 0), [ventas, totalIngresos]);

  // Productos con poco stock (< 15 unidades)
  const productosPocoStock = useMemo(() => productos.filter((p) => (p.stock ?? 50) < 15), [productos]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-4 sm:p-8 selection:bg-pink-500 selection:text-white">
      {/* HEADER DE ADMINISTRACIÓN */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-pink-500/30 p-5 rounded-3xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl hover:bg-slate-800 text-pink-400 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
                Panel de Administración
              </h1>
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-400" /> Estadísticas, Reportes Diarios e Inventario
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-black text-cyan-300 transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar Datos
          </button>
        </div>

        {/* METRICAS PRINCIPALES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Ventas Totales</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">${totalIngresos.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Ticket Promedio</span>
              <span className="text-2xl font-black text-cyan-400 font-mono">${Math.round(ticketPromedio).toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Descuentos Otorgados</span>
              <span className="text-2xl font-black text-rose-400 font-mono">${totalDescuentos.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-400">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Total Órdenes Cobradas</span>
              <span className="text-2xl font-black text-purple-400 font-mono">{ventas.length}</span>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ALERTA DE STOCK */}
        {productosPocoStock.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/50 p-4 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>
              Atención: Tienes <strong>{productosPocoStock.length} productos</strong> con inventario bajo (&lt; 15 unidades). Revisa el panel de inventario abajo.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SECCIÓN VENTAS AGRUPADAS POR FECHAS (CARPETAS) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-400" /> Registro de Ventas por Días
            </h3>

            {loading ? (
              <div className="text-center py-12 text-slate-500 font-bold text-xs">Cargando reporte de ventas...</div>
            ) : Object.keys(ventasPorDia).length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center text-slate-500 font-bold text-xs">
                Aún no hay ventas cobradas registradas.
              </div>
            ) : (
              Object.entries(ventasPorDia).map(([fecha, ventasDia]) => {
                const isOpen = !!openFolders[fecha];
                const totalDia = ventasDia.reduce((a, b) => a + (b.total || 0), 0);

                return (
                  <div key={fecha} className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    {/* CABECERA CARPETA DÍA */}
                    <button
                      onClick={() => toggleFolder(fecha)}
                      className="w-full p-4 bg-slate-900 hover:bg-slate-850 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? <FolderOpen className="w-6 h-6 text-pink-400" /> : <Folder className="w-6 h-6 text-pink-500" />}
                        <div className="text-left">
                          <span className="font-black text-sm text-white block">{fecha}</span>
                          <span className="text-[10px] font-bold text-slate-400">{ventasDia.length} Transacciones cobradas</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono text-emerald-400 font-black text-sm">${totalDia.toLocaleString()}</span>
                        {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                      </div>
                    </button>

                    {/* CONTENIDO CARPETA EXPANDIDA (DESGLOSE INDIVIDUAL DE CADA VENTA) */}
                    {isOpen && (
                      <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/50">
                        {ventasDia.map((v) => (
                          <div key={v.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                              <span className="font-black text-xs text-white">Mesa #{v.numero_mesa || v.mesa_id}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* DETALLE DE PRODUCTOS */}
                            <div className="space-y-1 my-2">
                              {v.items_detalle?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-300">
                                  <span>{item.cantidad}x {item.nombre}</span>
                                  <span className="font-mono text-slate-400">${(item.precio * item.cantidad).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs font-black">
                              <span className="uppercase text-[9px] bg-slate-900 text-pink-400 px-2 py-0.5 rounded-full border border-slate-800">
                                Pago: {v.metodo_pago}
                              </span>
                              <span className="font-mono text-emerald-400 text-sm">${v.total?.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* SECCIÓN INVENTARIO Y STOCK */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" /> Estado de Inventario / Stock
            </h3>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3 max-h-[600px] overflow-y-auto">
              {productos.map((p) => {
                const stockVal = p.stock ?? 50;
                const isLow = stockVal < 15;

                return (
                  <div key={p.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <h5 className="font-black text-xs text-slate-100">{p.nombre}</h5>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{p.categoria}</span>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-black font-mono block ${isLow ? "text-rose-400" : "text-emerald-400"}`}>
                        {stockVal} Unidades
                      </span>
                      {isLow && <span className="text-[8px] font-black text-rose-500 uppercase">Stock Bajo</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}