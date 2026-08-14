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
  Wallet,
  CheckCircle2,
  Receipt,
  PlusCircle,
  MinusCircle,
  X,
  BookOpenCheck,
  ShoppingCart,
  User,
  Eye,
  EyeOff,
} from "lucide-react";

interface Venta {
  id: number;
  created_at: string;
  mesa_id: number;
  numero_mesa: number;
  metodo_pago: string;
  cliente_nombre?: string;
  subtotal: number;
  descuento: number;
  total: number;
  items_detalle: { nombre: string; cantidad: number; precio: number }[];
}

interface Compra {
  id?: number;
  fecha: string;
  descripcion: string;
  monto: number;
  created_at?: string;
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
  const [compras, setCompras] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // ESTADO PARA EL OJITO (TOGGLE DE ITEMS POR VENTA)
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

  // Modales
  const [selectedFiado, setSelectedFiado] = useState<Venta | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<"efectivo" | "nequi" | "daviplata" | "tarjeta">("efectivo");
  const [showAllFiadosModal, setShowAllFiadosModal] = useState(false);

  const [showCompraModal, setShowCompraModal] = useState<string | null>(null);
  const [compraText, setCompraText] = useState("");
  const [compraMonto, setCompraMonto] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("ventas").select("*").order("created_at", { ascending: false });
      const { data: pData } = await supabase.from("productos").select("*").order("stock", { ascending: true });
      const { data: cData } = await supabase.from("compras").select("*").order("created_at", { ascending: false });

      if (vData) setVentas(vData as Venta[]);
      if (pData) setProductos(pData as Producto[]);
      if (cData) setCompras(cData as Compra[]);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const ventasPorDia = useMemo(() => {
    const grupos: Record<string, Venta[]> = {};
    ventas.forEach((v) => {
      const fecha = new Date(v.created_at).toISOString().split("T")[0];
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(v);
    });
    return grupos;
  }, [ventas]);

  const comprasPorDia = useMemo(() => {
    const grupos: Record<string, Compra[]> = {};
    compras.forEach((c) => {
      if (!grupos[c.fecha]) grupos[c.fecha] = [];
      grupos[c.fecha].push(c);
    });
    return grupos;
  }, [compras]);

  const listaFiadosActivos = useMemo(() => {
    return ventas.filter((v) => v.metodo_pago === "fiado");
  }, [ventas]);

  const toggleFolder = (fecha: string) => {
    setOpenFolders((prev) => ({ ...prev, [fecha]: !prev[fecha] }));
  };

  // Toggle para el Ojito
  const toggleItems = (ventaId: number) => {
    setOpenItems((prev) => ({ ...prev, [ventaId]: !prev[ventaId] }));
  };

  const handleSaldarFiado = async () => {
    if (!selectedFiado) return;

    const { error } = await supabase
      .from("ventas")
      .update({ metodo_pago: newPaymentMethod })
      .eq("id", selectedFiado.id);

    if (!error) {
      setSelectedFiado(null);
      loadData();
    }
  };

  const handleAddCompra = async () => {
    if (!showCompraModal || !compraText.trim() || !compraMonto) return;

    const montoVal = Number(compraMonto) || 0;

    const { error } = await supabase.from("compras").insert({
      fecha: showCompraModal,
      descripcion: compraText,
      monto: montoVal,
    });

    if (error) {
      setCompras((prev) => [
        ...prev,
        { fecha: showCompraModal, descripcion: compraText, monto: montoVal },
      ]);
    } else {
      loadData();
    }

    setCompraText("");
    setCompraMonto("");
    setShowCompraModal(null);
  };

  const totalIngresos = useMemo(() => ventas.reduce((acc, v) => acc + (v.metodo_pago !== "fiado" ? v.total || 0 : 0), 0), [ventas]);
  const totalFiadosPendientes = useMemo(() => ventas.reduce((acc, v) => acc + (v.metodo_pago === "fiado" ? v.total || 0 : 0), 0), [ventas]);
  const totalGastosCompras = useMemo(() => compras.reduce((acc, c) => acc + (c.monto || 0), 0), [compras]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-4 sm:p-8 selection:bg-pink-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER ADMIN */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-pink-500/30 p-5 rounded-3xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl hover:bg-slate-800 text-pink-400 transition-all cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
                Panel de Administración
              </h1>
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-400" /> Control de Ventas, Fiados y Compras Diarias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setShowAllFiadosModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 hover:to-orange-400 font-black rounded-xl text-xs uppercase flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer active:scale-95 transition-all"
            >
              <BookOpenCheck className="w-4 h-4" /> Fiados Pendientes ({listaFiadosActivos.length})
            </button>

            <button onClick={loadData} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-black text-cyan-300 transition-all flex items-center gap-2 cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Total Recaudado</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">${totalIngresos.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 block">Fiados por Cobrar</span>
              <span className="text-2xl font-black text-amber-400 font-mono">${totalFiadosPendientes.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpenCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-rose-400 block">Total Compras/Gastos</span>
              <span className="text-2xl font-black text-rose-400 font-mono">${totalGastosCompras.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase text-cyan-400 block">Caja Neta Global</span>
              <span className="text-2xl font-black text-cyan-400 font-mono">${(totalIngresos - totalGastosCompras).toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-400" /> Historial de Días
            </h3>

            {loading ? (
              <div className="text-center py-12 text-slate-500 font-bold text-xs">Cargando reporte...</div>
            ) : (
              Object.entries(ventasPorDia).map(([fecha, ventasDia]) => {
                const isOpen = !!openFolders[fecha];
                const comprasDia = comprasPorDia[fecha] || [];

                const totalBrutoDia = ventasDia.reduce((a, b) => a + (b.metodo_pago !== "fiado" ? b.total || 0 : 0), 0);
                const totalComprasDia = comprasDia.reduce((a, b) => a + (b.monto || 0), 0);
                const totalNetoDia = totalBrutoDia - totalComprasDia;

                const porMetodo = ventasDia.reduce(
                  (acc, v) => {
                    const m = (v.metodo_pago || "efectivo").toLowerCase();
                    acc[m] = (acc[m] || 0) + (v.total || 0);
                    return acc;
                  },
                  {} as Record<string, number>
                );

                return (
                  <div key={fecha} className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="p-4 bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80">
                      <button
                        onClick={() => toggleFolder(fecha)}
                        className="flex items-center gap-3 cursor-pointer text-left"
                      >
                        {isOpen ? <FolderOpen className="w-6 h-6 text-pink-400" /> : <Folder className="w-6 h-6 text-pink-500" />}
                        <div>
                          <span className="font-black text-sm text-white block">{fecha}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {ventasDia.length} Transacciones | {comprasDia.length} Compras
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase text-slate-400 block">Total Neto Día</span>
                          <span className="font-mono text-emerald-400 font-black text-sm">${totalNetoDia.toLocaleString()}</span>
                        </div>

                        <button
                          onClick={() => setShowCompraModal(fecha)}
                          className="px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-black hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Compras
                        </button>

                        <button onClick={() => toggleFolder(fecha)} className="p-1 cursor-pointer">
                          {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-4 space-y-4 bg-slate-950/50">
                        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                          <h4 className="text-[10px] font-black uppercase text-pink-400 mb-2 flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" /> Desglose Métodos de Pago:
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-bold">
                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
                              💵 Efectivo: <span className="font-mono text-emerald-400 block text-xs">${(porMetodo["efectivo"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
                              📱 Nequi: <span className="font-mono text-purple-400 block text-xs">${(porMetodo["nequi"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
                              🔴 Daviplata: <span className="font-mono text-rose-400 block text-xs">${(porMetodo["daviplata"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
                              💳 Tarjeta: <span className="font-mono text-cyan-400 block text-xs">${(porMetodo["tarjeta"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-2 bg-amber-950/40 rounded-xl border border-amber-500/40 text-amber-300">
                              📌 Fiado: <span className="font-mono text-amber-400 block text-xs">${(porMetodo["fiado"] || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {comprasDia.length > 0 && (
                          <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-2xl space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-1">
                              <MinusCircle className="w-3.5 h-3.5" /> Compras / Gastos del Día (-${totalComprasDia.toLocaleString()}):
                            </h4>
                            <div className="space-y-1">
                              {comprasDia.map((comp, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs font-bold text-rose-200 bg-slate-950 p-2 rounded-xl">
                                  <span>{comp.descripcion}</span>
                                  <span className="font-mono text-rose-400">-${comp.monto.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400">Comandas y Transacciones:</h4>
                          {ventasDia.map((v) => {
                            const isFiado = v.metodo_pago === "fiado";
                            const itemsVisibles = !!openItems[v.id];

                            return (
                              <div
                                key={v.id}
                                className={`p-4 rounded-2xl border space-y-2 transition-all ${
                                  isFiado ? "bg-amber-950/20 border-amber-500/60" : "bg-slate-950 border-slate-800"
                                }`}
                              >
                                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                                  <div>
                                    <span className="font-black text-xs text-white block">Espacio #{v.numero_mesa || v.mesa_id}</span>
                                    {isFiado && v.cliente_nombre && (
                                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                        <User className="w-3 h-3" /> Cliente: {v.cliente_nombre}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>

                                    {/* BOTÓN OJITO TOGGLE */}
                                    <button
                                      onClick={() => toggleItems(v.id)}
                                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-pink-400 transition-all cursor-pointer flex items-center gap-1 border border-slate-800 text-[10px] font-bold"
                                      title={itemsVisibles ? "Ocultar Productos" : "Ver Productos"}
                                    >
                                      {itemsVisibles ? <EyeOff className="w-3.5 h-3.5 text-pink-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                      <span className="hidden sm:inline">{itemsVisibles ? "Ocultar" : "Ver Items"}</span>
                                    </button>
                                  </div>
                                </div>

                                {/* LISTA DE PRODUCTOS (TOGGLEABLE CON EL OJITO EN TODOS LOS MÉTODOS DE PAGO) */}
                                {itemsVisibles && (
                                  <div className="space-y-1 my-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 animate-fadeIn">
                                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Detalle del Consumo:</span>
                                    {v.items_detalle?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-300">
                                        <span>{item.cantidad}x {item.nombre}</span>
                                        <span className="font-mono text-slate-400">${(item.precio * item.cantidad).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs font-black">
                                  <span
                                    className={`uppercase text-[9px] px-2.5 py-1 rounded-full border ${
                                      isFiado ? "bg-amber-500/20 text-amber-300 border-amber-500/50" : "bg-slate-900 text-pink-400 border-slate-800"
                                    }`}
                                  >
                                    Pago: {v.metodo_pago}
                                  </span>

                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-emerald-400 text-sm">${v.total?.toLocaleString()}</span>

                                    {isFiado && (
                                      <button
                                        onClick={() => setSelectedFiado(v)}
                                        className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[10px] uppercase rounded-xl hover:scale-105 transition-all cursor-pointer shadow-md"
                                      >
                                        Saldar Fiado
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* INVENTARIO */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" /> Inventario de Stock
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

      {/* MODAL GENERAL DE TODOS LOS FIADOS PENDIENTES */}
      {showAllFiadosModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-amber-400" /> Cuentas Fiadas Pendientes ({listaFiadosActivos.length})
              </h3>
              <button onClick={() => setShowAllFiadosModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {listaFiadosActivos.length === 0 ? (
              <div className="text-center py-10 text-slate-500 font-bold text-xs">
                🎉 No hay cuentas fiadas pendientes por cobrar.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {listaFiadosActivos.map((fiado) => (
                  <div key={fiado.id} className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-2">
                    <div className="flex justify-between items-start pb-2 border-b border-slate-900">
                      <div>
                        {fiado.cliente_nombre ? (
                          <span className="font-black text-sm text-amber-300 flex items-center gap-1.5 uppercase">
                            <User className="w-4 h-4 text-amber-400" /> {fiado.cliente_nombre}
                          </span>
                        ) : (
                          <span className="font-black text-xs text-white uppercase block">Cliente sin Nombre</span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          Espacio #{fiado.numero_mesa || fiado.mesa_id} | {new Date(fiado.created_at).toLocaleDateString()} - {new Date(fiado.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <span className="font-mono text-amber-400 font-black text-base">
                        ${fiado.total?.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1 my-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Historial de Consumo:</span>
                      {fiado.items_detalle?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-300">
                          <span>{item.cantidad}x {item.nombre}</span>
                          <span className="font-mono text-slate-400">${(item.precio * item.cantidad).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedFiado(fiado);
                          setShowAllFiadosModal(false);
                        }}
                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-xl hover:scale-105 transition-all cursor-pointer shadow-md"
                      >
                        Saldar Fiado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SALDAR FIADO */}
      {selectedFiado && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-amber-400" /> Saldar Cuenta Fiada
              </h3>
              <button onClick={() => setSelectedFiado(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
              {selectedFiado.cliente_nombre && (
                <p className="text-amber-400 font-black uppercase text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Cliente: {selectedFiado.cliente_nombre}
                </p>
              )}
              <p className="text-slate-400 font-bold">Monto a cancelar:</p>
              <p className="text-xl font-black font-mono text-emerald-400">${selectedFiado.total?.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-300 block">¿Con qué método pagó el cliente?</label>
              <div className="grid grid-cols-2 gap-2">
                {(["efectivo", "nequi", "daviplata", "tarjeta"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setNewPaymentMethod(m)}
                    className={`py-2 rounded-xl text-xs font-black uppercase transition-all border cursor-pointer ${
                      newPaymentMethod === m ? "bg-pink-500 text-white border-pink-400 shadow-md" : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaldarFiado}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-all"
            >
              ✅ Marcar como Pagado
            </button>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COMPRA */}
      {showCompraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-rose-400" /> Agregar Compra ({showCompraModal})
              </h3>
              <button onClick={() => setShowCompraModal(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Descripción de la Compra / Gasto:</label>
                <input
                  type="text"
                  placeholder="Ej: Leche, Vasos, Fruta..."
                  value={compraText}
                  onChange={(e) => setCompraText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Valor Numérico ($):</label>
                <input
                  type="number"
                  placeholder="Ej: 25000"
                  value={compraMonto}
                  onChange={(e) => setCompraMonto(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleAddCompra}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-all"
            >
              ➕ Registrar Gasto y Descontar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}