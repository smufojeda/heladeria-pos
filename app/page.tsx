"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ShoppingBag,
  CreditCard,
  Receipt,
  Search,
  Sparkles,
  ArrowLeft,
  X,
  Plus,
  Minus,
  ChefHat,
  LayoutGrid,
  Check,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  DollarSign,
  Calculator,
  Wallet,
  Lock,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type EstadoMesa = "libre" | "pendiente_servir" | "preparado" | "servido" | "pendiente_pago";
type ModoVista = "caja" | "mesero" | "cocina";
type MetodoPago = "efectivo" | "nequi" | "daviplata" | "tarjeta" | "fiado";

interface Mesa {
  id: number;
  numero: number;
  nombre: string;
  estado: EstadoMesa;
  capacidad: number;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  disponible: boolean;
  stock?: number;
}

interface CartItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
  es_adicion?: boolean;
}

interface PagoParcial {
  metodo: MetodoPago;
  monto: number;
  montoEntregadoEfectivo?: number;
  cambioEfectivo?: number;
  clienteFiado?: string;
}

interface PedidoCocina {
  id: number;
  mesa_id: number;
  created_at: string;
  estado_pedido: string;
  total: number;
  mesas: { nombre: string; numero: number };
  pedido_items: {
    id: number;
    cantidad: number;
    notas: string;
    es_adicion: boolean;
    precio_unitario: number;
    productos: { nombre: string };
  }[];
}

export default function HomePOS() {
  const [vista, setVista] = useState<ModoVista>("mesero");
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidosCocina, setPedidosCocina] = useState<PedidoCocina[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [initialItemsCount, setInitialItemsCount] = useState<number>(0);

  // Estado para desplegar el carrito en móvil
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Modal Caja Inteligente
  const [showCheckout, setShowCheckout] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"monto" | "porcentaje">("monto");
  
  // Estados para Pago Mixto y Caja
  const [pagos, setPagos] = useState<PagoParcial[]>([]);
  const [currentMetodo, setCurrentMetodo] = useState<MetodoPago>("efectivo");
  const [montoIngresado, setMontoIngresado] = useState<string>("");
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");
  const [clienteFiado, setClienteFiado] = useState<string>("");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  const categories = useMemo(() => {
    const cats = new Set(productos.map((p) => p.categoria).filter(Boolean));
    return ["Todos", ...Array.from(cats)];
  }, [productos]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase.from("mesas").select("*").order("numero", { ascending: true });
      const { data: prodData } = await supabase.from("productos").select("*").order("id", { ascending: true });

      if (mesasData && mesasData.length > 0) {
        const formattedMesas = mesasData.map((m, idx) => {
          let customName = m.nombre;
          if (idx < 5) customName = `Mesa ${idx + 1}`;
          else if (idx === 5) customName = "Barra 1";
          else if (idx === 6) customName = "Barra 2";

          return { ...m, nombre: customName };
        });
        setMesas(formattedMesas as Mesa[]);
      }
      if (prodData && prodData.length > 0) setProductos(prodData);

      fetchPedidosCocina();
    } catch (_) {}
    setLoading(false);
  };

  const fetchPedidosCocina = async () => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, mesas!inner(nombre, numero, estado), pedido_items(*, productos(nombre))")
      .eq("estado", "abierto")
      .eq("estado_pedido", "pendiente_servir")
      .order("id", { ascending: true });

    if (data) setPedidosCocina(data as any);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectMesa = async (mesa: Mesa) => {
    if (vista === "caja" && mesa.estado === "libre") return;

    setSelectedMesa(mesa);
    setCart([]);
    setInitialItemsCount(0);
    setShowCheckout(false);
    setSaleCompleted(false);
    setShowMobileCart(false);
    setPagos([]);
    setMontoIngresado("");
    setEfectivoRecibido("");
    setClienteFiado("");

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", mesa.id)
      .eq("estado", "abierto")
      .single();

    if (pedido) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("*, productos(*)")
        .eq("pedido_id", pedido.id);

      if (items) {
        const loadedCart: CartItem[] = items.map((it: any) => ({
          producto: it.productos,
          cantidad: it.cantidad,
          notas: it.notas || "",
          es_adicion: it.es_adicion || false,
        }));
        setCart(loadedCart);
        setInitialItemsCount(loadedCart.reduce((acc, i) => acc + i.cantidad, 0));
      }
    }

    if (vista === "caja" && mesa.estado !== "libre") {
      setShowCheckout(true);
    }
  };

  const addToCart = (producto: Producto) => {
    if (vista === "caja") return;
    setCart((prev) => {
      const isAdicion = initialItemsCount > 0;
      const existing = prev.find(
        (item) => item.producto.id === producto.id && item.es_adicion === isAdicion
      );

      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id && item.es_adicion === isAdicion
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1, es_adicion: isAdicion }];
    });
  };

  const updateQuantity = (productoId: number, delta: number, esAdicion: boolean = false) => {
    if (vista === "caja") return;
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId && item.es_adicion === esAdicion) {
            const newQty = item.cantidad + delta;
            return newQty > 0 ? { ...item, cantidad: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotalAmount = useMemo(() => cart.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0), [cart]);

  const discountVal = useMemo(() => {
    const val = Number(discountInput) || 0;
    return discountType === "porcentaje" ? (subtotalAmount * val) / 100 : val;
  }, [discountInput, discountType, subtotalAmount]);

  const finalTotal = useMemo(() => Math.max(0, subtotalAmount - discountVal), [subtotalAmount, discountVal]);

  const totalPagado = useMemo(() => pagos.reduce((acc, p) => acc + p.monto, 0), [pagos]);
  const saldoPendiente = useMemo(() => Math.max(0, finalTotal - totalPagado), [finalTotal, totalPagado]);

  const handleAgregarPago = () => {
    const monto = Number(montoIngresado);
    if (!monto || monto <= 0) {
      alert("Ingresa un monto válido a pagar.");
      return;
    }

    if (currentMetodo === "efectivo") {
      const recibido = Number(efectivoRecibido);
      if (recibido < monto) {
        alert("El dinero en efectivo recibido es menor al monto a pagar asignado.");
        return;
      }
      const cambio = recibido - monto;
      setPagos((prev) => [
        ...prev,
        {
          metodo: "efectivo",
          monto,
          montoEntregadoEfectivo: recibido,
          cambioEfectivo: cambio,
        },
      ]);
    } else if (currentMetodo === "fiado") {
      if (!clienteFiado.trim()) {
        alert("Debes indicar el nombre de la persona a la que le vas a fiar.");
        return;
      }
      setPagos((prev) => [
        ...prev,
        {
          metodo: "fiado",
          monto,
          clienteFiado: clienteFiado.trim(),
        },
      ]);
    } else {
      setPagos((prev) => [...prev, { metodo: currentMetodo, monto }]);
    }

    setMontoIngresado("");
    setEfectivoRecibido("");
  };

  const handleEliminarPago = (index: number) => {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (!selectedMesa || vista === "caja") return;

    await supabase.from("mesas").update({ estado: "pendiente_servir" }).eq("id", selectedMesa.id);

    let { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", selectedMesa.id)
      .eq("estado", "abierto")
      .single();

    if (!pedido) {
      const { data: newPedido } = await supabase
        .from("pedidos")
        .insert({ mesa_id: selectedMesa.id, total: subtotalAmount, estado: "abierto", estado_pedido: "pendiente_servir" })
        .select()
        .single();
      pedido = newPedido;
    } else {
      await supabase.from("pedidos").update({ total: subtotalAmount, estado_pedido: "pendiente_servir" }).eq("id", pedido.id);
      await supabase.from("pedido_items").delete().eq("pedido_id", pedido.id);
    }

    if (pedido && cart.length > 0) {
      const itemsToInsert = cart.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        es_adicion: item.es_adicion || false,
      }));
      await supabase.from("pedido_items").insert(itemsToInsert);

      for (const item of cart) {
        const { data: prodData } = await supabase.from("productos").select("stock").eq("id", item.producto.id).single();
        if (prodData) {
          const currentStock = prodData.stock ?? 50;
          const newStock = Math.max(0, currentStock - item.cantidad);
          await supabase.from("productos").update({ stock: newStock, disponible: newStock > 0 }).eq("id", item.producto.id);
        }
      }
    }

    fetchData();
    setSelectedMesa(null);
  };

  const handleEntregarAMesa = async (mesaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("mesas").update({ estado: "servido" }).eq("id", mesaId);
    await supabase.from("pedidos").update({ estado_pedido: "servido" }).eq("mesa_id", mesaId).eq("estado", "abierto");
    fetchData();
  };

  const handleCocinaListo = async (pedidoId: number, mesaId: number) => {
    await supabase.from("pedidos").update({ estado_pedido: "preparado" }).eq("id", pedidoId);
    await supabase.from("mesas").update({ estado: "preparado" }).eq("id", mesaId);
    fetchData();
  };

  const handleCancelarComanda = async (pedidoId: number, mesaId: number) => {
    if (confirm("¿Estás seguro de eliminar/cancelar esta comanda? La mesa quedará libre.")) {
      await supabase.from("pedido_items").delete().eq("pedido_id", pedidoId);
      await supabase.from("pedidos").delete().eq("id", pedidoId);
      await supabase.from("mesas").update({ estado: "libre" }).eq("id", mesaId);
      fetchData();
    }
  };

  const handleFinalizeSale = async () => {
    if (!selectedMesa) return;

    if (saldoPendiente > 0) {
      alert(`No se puede liberar la mesa. Aún hay un saldo pendiente de $${saldoPendiente.toLocaleString()}`);
      return;
    }

    const itemsSummary = cart.map((i) => ({
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
    }));

    const fiadoItem = pagos.find((p) => p.metodo === "fiado");

    await supabase.from("ventas").insert({
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: pagos.map((p) => p.metodo).join(", "),
      desglose_pagos: pagos,
      cliente_nombre: fiadoItem ? fiadoItem.clienteFiado : null,
      subtotal: subtotalAmount,
      descuento: discountVal,
      total: finalTotal,
      items_detalle: itemsSummary,
    });

    await supabase.from("pedidos").update({ estado: "pagado", estado_pedido: "servido" }).eq("mesa_id", selectedMesa.id).eq("estado", "abierto");
    await supabase.from("mesas").update({ estado: "libre" }).eq("id", selectedMesa.id);

    setSaleCompleted(true);
    fetchData();
  };

  const filteredProducts = productos.filter((p) => {
    const matchesCat = selectedCategory === "Todos" || p.categoria === selectedCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartIniciales = useMemo(() => cart.filter((i) => !i.es_adicion), [cart]);
  const cartAdiciones = useMemo(() => cart.filter((i) => i.es_adicion), [cart]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-pink-500 selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-pink-500/30 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-1 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <img src="/cafe.png" alt="Logo Café" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
              Anti Café POS
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-400" /> Control Integral de Servicio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/90 w-full md:w-auto justify-center flex-wrap">
          <button
            onClick={() => { setVista("caja"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              vista === "caja" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> CAJA
          </button>

          <button
            onClick={() => { setVista("mesero"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              vista === "mesero" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> MESERO
          </button>

          <button
            onClick={() => { setVista("cocina"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer relative ${
              vista === "cocina" ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <ChefHat className="w-4 h-4" /> COCINA
            {pedidosCocina.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />
            )}
          </button>

          <Link
            href="/admin"
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" /> ADMIN
          </Link>
        </div>
      </header>

      {/* VISTA COCINA */}
      {vista === "cocina" && (
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mb-6">
            <ChefHat className="w-7 h-7 text-amber-400" /> Pedidos de Cocina ({pedidosCocina.length})
          </h2>

          {pedidosCocina.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-bold bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
              🍳 No hay comandas pendientes en cocina.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pedidosCocina.map((p) => {
                const entredados = p.pedido_items?.filter((i) => !i.es_adicion) || [];
                const adiciones = p.pedido_items?.filter((i) => i.es_adicion) || [];

                return (
                  <div key={p.id} className="bg-slate-900 border-2 border-amber-500/60 p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative">
                    <div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800 pr-8">
                        <h3 className="font-black text-xl text-white">{p.mesas?.nombre || `Espacio ${p.mesa_id}`}</h3>
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCancelarComanda(p.id, p.mesa_id)}
                        className="absolute top-5 right-5 p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="my-5 space-y-4">
                        {entredados.length > 0 && adiciones.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">
                              ✅ Productos ya entregados:
                            </span>
                            {entredados.map((it) => (
                              <div key={it.id} className="flex justify-between items-center text-xs font-bold p-2.5 rounded-xl border bg-emerald-950/20 border-emerald-500/40 text-emerald-300 opacity-70">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  {it.cantidad}x {it.productos?.nombre}
                                </span>
                                <span className="font-mono text-[11px]">${(it.precio_unitario * it.cantidad).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          {adiciones.length > 0 && (
                            <span className="text-[10px] font-black uppercase text-rose-400 block tracking-wider">
                              🚨 Productos a añadir:
                            </span>
                          )}

                          {(adiciones.length > 0 ? adiciones : p.pedido_items)?.map((it) => (
                            <div key={it.id} className="flex justify-between items-center text-sm font-bold p-3 rounded-xl border bg-slate-950/80 border-slate-800 text-slate-200 shadow-md">
                              <span className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                {it.cantidad}x {it.productos?.nombre}
                              </span>
                              <span className="font-mono text-xs text-slate-400">${(it.precio_unitario * it.cantidad).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-sm font-black">
                        <span className="text-slate-400">TOTAL COMANDA:</span>
                        <span className="font-mono text-emerald-400 text-base">${p.total?.toLocaleString()}</span>
                      </div>

                      <button
                        onClick={() => handleCocinaListo(p.id, p.mesa_id)}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                      >
                        <Check className="w-5 h-5" /> LISTO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VISTAS CAJA Y MESERO */}
      {vista !== "cocina" && (
        <>
          {!selectedMesa ? (
            <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {mesas.map((mesa) => {
                  const isLibre = mesa.estado === "libre";
                  const isPendServir = mesa.estado === "pendiente_servir";
                  const isPreparado = mesa.estado === "preparado";
                  const isServido = mesa.estado === "servido";

                  return (
                    <div
                      key={mesa.id}
                      onClick={() => handleSelectMesa(mesa)}
                      className={`group relative rounded-3xl p-5 border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-xl ${
                        isLibre
                          ? "bg-slate-900/80 border-emerald-500/30"
                          : isPendServir
                          ? "bg-amber-950/20 border-amber-400/60"
                          : isPreparado
                          ? "bg-purple-950/30 border-purple-500 animate-pulse"
                          : "bg-cyan-950/20 border-cyan-400/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-black text-xl text-white">{mesa.nombre}</h3>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase bg-slate-800 text-slate-300">
                          {mesa.estado.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex-1 flex justify-center items-center my-1">
                        <img src={isLibre ? "/mesa1.png" : "/mesa2.png"} alt={mesa.nombre} className="h-28 w-auto object-contain" />
                      </div>

                      <div className="pt-2 border-t border-slate-800/80">
                        {vista === "caja" ? (
                          <button
                            className={`w-full py-1.5 font-black text-xs rounded-xl border transition-all ${
                              isLibre
                                ? "bg-slate-950 text-slate-500 border-slate-800 cursor-not-allowed"
                                : "bg-pink-500/20 text-pink-300 border-pink-500/40 hover:bg-pink-500 hover:text-white"
                            }`}
                          >
                            {isLibre ? "Disponible" : "💳 Cobrar"}
                          </button>
                        ) : (
                          <div>
                            {isPreparado ? (
                              <button
                                onClick={(e) => handleEntregarAMesa(mesa.id, e)}
                                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5"
                              >
                                <Send className="w-3.5 h-3.5" /> Entregar
                              </button>
                            ) : (
                              <div className="text-[10px] font-black text-center text-slate-400 py-1">
                                {isLibre ? "+ Tomar Pedido" : isServido ? "➕ Agregar Adición" : "Ver / Modificar Comanda"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              
              {/* CONTENEDOR PRINCIPAL IZQUIERDO (PRODUCTOS Y BUSCADOR) */}
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                
                {/* 1er MENÚ FIJO EN LA PARTE SUPERIOR (BUSCADOR, VOLVER Y CATEGORÍAS) */}
                <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 p-3 sm:p-4 shadow-md space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedMesa(null)}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black text-slate-300 flex items-center gap-1.5 cursor-pointer hover:bg-slate-800 transition-all shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4 text-pink-400" /> <span className="hidden sm:inline">Volver a</span> Mesas
                    </button>

                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  {/* CATEGORÍAS EN SCROLL HORIZONTAL */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border cursor-pointer ${
                          selectedCategory === cat
                            ? "bg-pink-500 text-white border-pink-400 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {vista === "caja" && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] font-bold flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" /> Modo Caja: Vista de solo lectura. Para modificar cambia a vista Mesero.
                    </div>
                  )}
                </div>

                {/* LISTADO DE PRODUCTOS */}
                <div className="flex-1 p-3 sm:p-6 overflow-y-auto pb-28 lg:pb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between transition-all ${
                          vista === "mesero" ? "cursor-pointer hover:border-pink-500/50 active:scale-95" : "opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div>
                          <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">{p.categoria}</span>
                          <h4 className="font-black text-xs sm:text-sm text-white mt-1">{p.nombre}</h4>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">Stock: {p.stock ?? 50}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between items-center">
                          <span className="font-black text-xs sm:text-sm text-emerald-400 font-mono">${p.precio.toLocaleString()}</span>
                          {vista === "mesero" && (
                            <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 font-black flex items-center justify-center text-xs">+</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* 2do MENÚ FIJO INFERIOR EN MÓVIL Y PANEL LATERAL EN ESCRITORIO */}
              <div className="fixed lg:relative bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t lg:border-l border-slate-800 shadow-2xl transition-all duration-300">
                
                {/* BARRA MÓVIL SIEMPRE VISIBLE ABAJO */}
                <div className="lg:hidden p-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-black uppercase text-pink-400 block">{selectedMesa.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white font-mono">${subtotalAmount.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400">({cart.reduce((a, b) => a + b.cantidad, 0)} items)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* BOTÓN CON FLECHITA PARA DESPLEGAR/VER PRODUCTOS */}
                    <button
                      onClick={() => setShowMobileCart(!showMobileCart)}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-pink-400 hover:bg-slate-800 transition-all flex items-center justify-center cursor-pointer"
                    >
                      {showMobileCart ? <ChevronDown className="w-5 h-5 text-pink-400" /> : <ChevronUp className="w-5 h-5 text-pink-400" />}
                    </button>

                    {vista === "mesero" ? (
                      <button
                        onClick={handleSaveOrder}
                        disabled={cart.length === 0}
                        className={`px-3.5 py-2.5 font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all ${
                          cart.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer active:scale-95"
                        }`}
                      >
                        <ChefHat className="w-4 h-4" /> Cocina
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCheckout(true)}
                        disabled={cart.length === 0}
                        className={`px-3.5 py-2.5 font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all ${
                          cart.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-400 text-white shadow-md cursor-pointer active:scale-95"
                        }`}
                      >
                        <CreditCard className="w-4 h-4" /> Cobrar
                      </button>
                    )}
                  </div>
                </div>

                {/* CONTENIDO DEL DESGLOSE DE PRODUCTOS (DESPLEGABLE MÓVIL Y SIEMPRE VISIBLE EN PC) */}
                <div className={`${showMobileCart ? "block" : "hidden lg:block"} w-full lg:w-96 p-4 sm:p-5 flex flex-col justify-between max-h-[60vh] lg:max-h-none overflow-y-auto`}>
                  <div>
                    <h2 className="hidden lg:flex font-black text-lg text-white items-center gap-2 pb-3 border-b border-slate-800">
                      <Receipt className="w-5 h-5 text-pink-400" /> {selectedMesa.nombre}
                    </h2>
                    
                    <div className="my-3 space-y-2 max-h-[40vh] lg:max-h-[50vh] overflow-y-auto pr-1">
                      {cart.length === 0 ? (
                        <p className="text-xs text-slate-500 font-bold py-4 text-center">No hay productos añadidos</p>
                      ) : (
                        cart.map((item, idx) => (
                          <div key={`${item.producto.id}-${item.es_adicion ? "adicion" : "normal"}-${idx}`} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div>
                              <h5 className="font-black text-xs text-slate-100 flex items-center gap-1.5">
                                {item.producto.nombre}
                                {item.es_adicion && <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1 py-0.2 rounded font-bold">ADICIÓN</span>}
                              </h5>
                              <p className="text-[10px] text-slate-400 font-mono">${item.producto.precio.toLocaleString()}</p>
                            </div>
                            {vista === "mesero" ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQuantity(item.producto.id, -1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3" /></button>
                                <span className="font-black text-xs text-white">{item.cantidad}</span>
                                <button onClick={() => updateQuantity(item.producto.id, 1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <span className="font-black text-xs text-slate-300">x{item.cantidad}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="hidden lg:flex justify-between text-lg font-black text-white">
                      <span>TOTAL</span>
                      <span className="font-mono text-emerald-400">${subtotalAmount.toLocaleString()}</span>
                    </div>

                    {vista === "mesero" ? (
                      <button onClick={handleSaveOrder} disabled={cart.length === 0} className="hidden lg:flex w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-2xl shadow items-center justify-center gap-2 cursor-pointer active:scale-95">
                        <ChefHat className="w-5 h-5" /> Enviar a Cocina
                      </button>
                    ) : (
                      <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0} className="hidden lg:flex w-full py-3.5 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs uppercase rounded-2xl shadow items-center justify-center gap-2 cursor-pointer active:scale-95">
                        <CreditCard className="w-5 h-5" /> Ir al Módulo de Cobro
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </>
      )}

      {/* MODAL COBRO EN CAJA INTELIGENTE */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-pink-400" /> Cobrar - {selectedMesa.nombre}
                  </h3>
                  <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* RESUMEN CONSUMO */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-3 max-h-48 overflow-y-auto pr-1">
                  {cartIniciales.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                        🛒 Productos Pedidos:
                      </h4>
                      <div className="space-y-1">
                        {cartIniciales.map((item) => (
                          <div key={item.producto.id} className="flex justify-between items-center text-xs font-bold text-slate-200 border-b border-slate-900/60 pb-1">
                            <span>{item.cantidad}x {item.producto.nombre}</span>
                            <span className="font-mono text-slate-400">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cartAdiciones.length > 0 && (
                    <div className="pt-2 border-t border-slate-900">
                      <h4 className="text-[10px] font-black text-rose-400 uppercase mb-1.5 flex items-center gap-1">
                        ➕ Productos Añadidos Después:
                      </h4>
                      <div className="space-y-1">
                        {cartAdiciones.map((item) => (
                          <div key={item.producto.id} className="flex justify-between items-center text-xs font-bold text-rose-200 border-b border-slate-900/60 pb-1">
                            <span>{item.cantidad}x {item.producto.nombre}</span>
                            <span className="font-mono text-rose-300">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* APLICACIÓN DE DESCUENTO */}
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 mb-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> Descuento:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-right text-white"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white rounded-lg px-2 py-1"
                    >
                      <option value="monto">$</option>
                      <option value="porcentaje">%</option>
                    </select>
                  </div>
                </div>

                {/* TOTALES */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">${subtotalAmount.toLocaleString()}</span>
                  </div>
                  {discountVal > 0 && (
                    <div className="flex justify-between text-xs font-bold text-rose-400">
                      <span>Descuento aplicado:</span>
                      <span className="font-mono">-${discountVal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>TOTAL FINAL:</span>
                    <span className="font-mono">${finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* SECCIÓN CAJA INTELIGENTE */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-pink-500/30 mb-4 space-y-3">
                  <h4 className="text-xs font-black text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-pink-400" /> Registrar Forma de Pago
                  </h4>

                  <div className="grid grid-cols-5 gap-1.5">
                    {(["efectivo", "nequi", "daviplata", "tarjeta", "fiado"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setCurrentMetodo(m)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${
                          currentMetodo === m
                            ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">Monto a Asignar:</label>
                      <input
                        type="number"
                        placeholder={`Ej: ${saldoPendiente}`}
                        value={montoIngresado}
                        onChange={(e) => setMontoIngresado(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    {currentMetodo === "efectivo" && (
                      <div>
                        <label className="text-[10px] font-black text-amber-400 block mb-1">Billete Entregado:</label>
                        <input
                          type="number"
                          placeholder="Ej: 20000, 50000"
                          value={efectivoRecibido}
                          onChange={(e) => setEfectivoRecibido(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 focus:outline-none"
                        />
                      </div>
                    )}

                    {currentMetodo === "fiado" && (
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-amber-400 block mb-1">Nombre del Cliente (Fiado):</label>
                        <input
                          type="text"
                          placeholder="Ej: Carlos Ruiz, Doña María..."
                          value={clienteFiado}
                          onChange={(e) => setClienteFiado(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {currentMetodo === "efectivo" && Number(efectivoRecibido) > 0 && Number(montoIngresado) > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex justify-between items-center text-xs font-black text-amber-300">
                      <span>Devuelta / Cambio:</span>
                      <span className="font-mono text-sm">
                        ${Math.max(0, Number(efectivoRecibido) - Number(montoIngresado)).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleAgregarPago}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase rounded-xl border border-slate-700 transition-all cursor-pointer"
                  >
                    + Agregar Pago
                  </button>
                </div>

                {/* DESGLOSE DE PAGOS INGRESADOS */}
                {pagos.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase">Pagos Registrados:</h4>
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-bold bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <div>
                          <span className="uppercase text-pink-400">{p.metodo}</span>: ${p.monto.toLocaleString()}
                          {p.cambioEfectivo !== undefined && (
                            <span className="text-[10px] text-amber-300 block">
                              Recibido: ${p.montoEntregadoEfectivo?.toLocaleString()} | Cambio: ${p.cambioEfectivo.toLocaleString()}
                            </span>
                          )}
                          {p.clienteFiado && (
                            <span className="text-[10px] text-amber-400 block">Fiado a: {p.clienteFiado}</span>
                          )}
                        </div>
                        <button onClick={() => handleEliminarPago(idx)} className="text-rose-400 hover:text-white p-1 cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ALERTA DE SALDO / DEUDA */}
                <div className="mb-4">
                  {saldoPendiente > 0 ? (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs font-black text-rose-400">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> SALDO PENDIENTE / DEUDA:
                      </span>
                      <span className="font-mono text-sm">${saldoPendiente.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> COMPRA TOTALMENTE CUBIERTA
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFinalizeSale}
                  disabled={saldoPendiente > 0}
                  className={`w-full py-3.5 font-black uppercase text-xs rounded-2xl shadow-lg cursor-pointer transition-all ${
                    saldoPendiente > 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  }`}
                >
                  {saldoPendiente > 0 ? "⚠️ Pago Incompleto (No se puede liberar mesa)" : "✅ Finalizar Venta y Liberar Mesa"}
                </button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h3 className="font-black text-xl text-white">¡Venta Registrada Exitosamente!</h3>
                <p className="text-xs text-slate-400">La mesa ha sido liberada correctamente en el sistema.</p>
                <button onClick={() => { setShowCheckout(false); setSelectedMesa(null); }} className="w-full py-3 bg-pink-500 text-white font-black uppercase text-xs rounded-2xl cursor-pointer">
                  Volver al Mapa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}