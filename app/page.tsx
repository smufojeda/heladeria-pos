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
  ChevronUp,
  CheckCircle2,
  ChefHat,
  LayoutGrid,
  Check,
  Clock,
  ShieldCheck,
  Tag,
} from "lucide-react";

type EstadoMesa = "libre" | "pendiente_servir" | "preparado" | "servido" | "pendiente_pago";
type ModoVista = "caja" | "mesero" | "cocina";

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

interface PedidoCocina {
  id: number;
  mesa_id: number;
  created_at: string;
  estado_pedido: string;
  mesas: { nombre: string; numero: number };
  pedido_items: {
    id: number;
    cantidad: number;
    notas: string;
    es_adicion: boolean;
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
  const [activePedidoId, setActivePedidoId] = useState<number | null>(null);

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Modal Caja
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi" | "tarjeta">("efectivo");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"monto" | "porcentaje">("monto");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase.from("mesas").select("*").order("numero", { ascending: true });
      const { data: prodData } = await supabase.from("productos").select("*").order("id", { ascending: true });

      if (mesasData && mesasData.length > 0) setMesas(mesasData as Mesa[]);
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
      .eq("mesas.estado", "pendiente_servir")
      .order("id", { ascending: true });

    if (data) setPedidosCocina(data as any);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectMesa = async (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setCart([]);
    setActivePedidoId(null);
    setInitialItemsCount(0);
    setShowCheckout(false);
    setSaleCompleted(false);
    setDiscountInput("0");
    setCashReceived("");
    setIsMobileCartOpen(false);

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", mesa.id)
      .eq("estado", "abierto")
      .single();

    if (pedido) {
      setActivePedidoId(pedido.id);
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
    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      const isAdicion = initialItemsCount > 0;
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, es_adicion: item.es_adicion || isAdicion }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1, es_adicion: isAdicion }];
    });
  };

  const updateQuantity = (productoId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
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
    if (discountType === "porcentaje") {
      return (subtotalAmount * val) / 100;
    }
    return val;
  }, [discountInput, discountType, subtotalAmount]);

  const finalTotal = useMemo(() => Math.max(0, subtotalAmount - discountVal), [subtotalAmount, discountVal]);

  const handleSaveOrder = async () => {
    if (!selectedMesa) return;

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
    }

    fetchData();
    setSelectedMesa(null);
    setIsMobileCartOpen(false);
  };

  const handleCambiarEstadoMesa = async (mesaId: number, nuevoEstado: EstadoMesa, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("mesas").update({ estado: nuevoEstado }).eq("id", mesaId);
    fetchData();
  };

  const handleCocinaListo = async (pedidoId: number, mesaId: number) => {
    await supabase.from("pedidos").update({ estado_pedido: "preparado" }).eq("id", pedidoId);
    await supabase.from("mesas").update({ estado: "preparado" }).eq("id", mesaId);
    fetchData();
  };

  // FINALIZAR VENTA CON DESCUENTO DE STOCK
  const handleFinalizeSale = async () => {
    if (!selectedMesa) return;

    const itemsSummary = cart.map((i) => ({
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
    }));

    // 1. Registrar la venta en la tabla ventas
    await supabase.from("ventas").insert({
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: paymentMethod,
      subtotal: subtotalAmount,
      descuento: discountVal,
      total: finalTotal,
      items_detalle: itemsSummary,
    });

    // 2. DESCONTAR EL STOCK DE CADA PRODUCTO VENDIDO
    for (const item of cart) {
      // Intenta usar la función RPC rápida si la ejecutaste en SQL
      const { error: rpcError } = await supabase.rpc("descontar_stock", {
        p_id: item.producto.id,
        p_cantidad: item.cantidad,
      });

      // Fallback manual en caso de no tener la RPC creada
      if (rpcError) {
        const { data: prodData } = await supabase
          .from("productos")
          .select("stock")
          .eq("id", item.producto.id)
          .single();

        if (prodData) {
          const currentStock = prodData.stock ?? 50;
          const newStock = Math.max(0, currentStock - item.cantidad);
          await supabase
            .from("productos")
            .update({ stock: newStock, disponible: newStock > 0 })
            .eq("id", item.producto.id);
        }
      }
    }

    // 3. Cerrar comanda y liberar mesa
    await supabase.from("pedidos").update({ estado: "pagado", estado_pedido: "servido" }).eq("mesa_id", selectedMesa.id).eq("estado", "abierto");
    await supabase.from("mesas").update({ estado: "libre" }).eq("id", selectedMesa.id);

    setSaleCompleted(true);
    fetchData();
  };

  const categories = ["Todos", "Helados", "Especiales", "Toppings", "Bebidas"];
  const filteredProducts = productos.filter((p) => {
    const matchesCat = selectedCategory === "Todos" || p.categoria === selectedCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-pink-500 selection:text-white">
      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-pink-500/30 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-1 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <img src="/cafe.png" alt="Logo Café" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
              Heladería POS
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-400" /> Control Integral de Servicio
            </p>
          </div>
        </div>

        {/* CONTROLES DE VISTA + BOTÓN ADMIN */}
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
            {pedidosCocina.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />}
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
            <ChefHat className="w-7 h-7 text-amber-400" /> Pedidos por Preparar ({pedidosCocina.length})
          </h2>

          {pedidosCocina.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-bold bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
              🍳 No hay comandas pendientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pedidosCocina.map((p) => (
                <div key={p.id} className="bg-slate-900 border-2 border-amber-500/60 p-6 rounded-3xl flex flex-col justify-between shadow-2xl">
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                      <h3 className="font-black text-xl text-white">{p.mesas?.nombre || `Mesa ${p.mesa_id}`}</h3>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="my-5 space-y-3">
                      {p.pedido_items?.map((it) => (
                        <div key={it.id} className={`flex justify-between items-center text-sm font-bold p-3 rounded-xl border ${it.es_adicion ? "bg-rose-950/40 border-rose-500/80 text-rose-200" : "bg-slate-950/60 border-slate-800 text-slate-100"}`}>
                          <span className="flex items-center gap-2">
                            {it.cantidad}x {it.productos?.nombre}
                            {it.es_adicion && <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">🚨 ADICIÓN</span>}
                          </span>
                          {it.notas && <span className="text-amber-400 italic text-xs">({it.notas})</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCocinaListo(p.id, p.mesa_id)}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                  >
                    <Check className="w-5 h-5" /> Marcar Listo
                  </button>
                </div>
              ))}
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
                  const isPendPago = mesa.estado === "pendiente_pago";

                  return (
                    <div
                      key={mesa.id}
                      onClick={() => handleSelectMesa(mesa)}
                      className={`group relative rounded-3xl p-5 border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-xl ${
                        isLibre ? "bg-slate-900/80 border-emerald-500/30" : isPendServir ? "bg-amber-950/20 border-amber-400/60" : isPreparado ? "bg-purple-950/30 border-purple-500" : isServido ? "bg-cyan-950/20 border-cyan-400/60" : "bg-rose-950/20 border-rose-500/60"
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
                          <button className="w-full py-1.5 bg-pink-500/20 text-pink-300 border border-pink-500/40 font-black text-xs rounded-xl">
                            {isLibre ? "Mesa Libre" : "💳 Cobrar Mesa"}
                          </button>
                        ) : (
                          <div className="text-[10px] font-black text-center text-slate-400 py-1">
                            {isLibre ? "+ Tomar Pedido" : "Ver / Modificar Comanda"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          ) : (
            /* COMANDA INTERACTIVA */
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 pb-32 lg:pb-6">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setSelectedMesa(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-black text-slate-300 flex items-center gap-2 cursor-pointer">
                    <ArrowLeft className="w-4 h-4 text-pink-400" /> Volver a Mesas
                  </button>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-xs px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {filteredProducts.map((p) => (
                    <div key={p.id} onClick={() => addToCart(p)} className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl cursor-pointer hover:border-pink-500/50 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">{p.categoria}</span>
                        <h4 className="font-black text-sm text-white mt-1.5">{p.nombre}</h4>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">Stock: {p.stock ?? 50}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="font-black text-sm text-emerald-400 font-mono">${p.precio.toLocaleString()}</span>
                        <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 font-black flex items-center justify-center">+</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PANEL DIRECCIONAL COMANDA */}
              <div className="w-full lg:w-96 bg-slate-900/95 border-t lg:border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl">
                <div>
                  <h2 className="font-black text-lg text-white flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Receipt className="w-5 h-5 text-pink-400" /> {selectedMesa.nombre}
                  </h2>
                  <div className="my-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.producto.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <h5 className="font-black text-xs text-slate-100 flex items-center gap-1.5">
                            {item.producto.nombre}
                            {item.es_adicion && <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded-md font-bold">ADICIÓN</span>}
                          </h5>
                          <p className="text-[11px] text-slate-400 font-mono">${item.producto.precio.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.producto.id, -1)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black"><Minus className="w-3 h-3" /></button>
                          <span className="font-black text-xs text-white">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.producto.id, 1)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex justify-between text-lg font-black text-white">
                    <span>TOTAL</span>
                    <span className="font-mono text-emerald-400">${subtotalAmount.toLocaleString()}</span>
                  </div>
                  <button onClick={handleSaveOrder} disabled={cart.length === 0} className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-2xl shadow flex items-center justify-center gap-2">
                    <ChefHat className="w-5 h-5" /> Enviar a Cocina
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL COBRO EN CAJA CON DESGLOSE Y DESCUENTOS */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    💳 Cobrar - {selectedMesa.nombre}
                  </h3>
                  <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* DESGLOSE DE CONSUMO */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Resumen de Productos Consumidos:</h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.producto.id} className="flex justify-between items-center text-xs font-bold text-slate-200 border-b border-slate-900 pb-1">
                        <span>{item.cantidad}x {item.producto.nombre}</span>
                        <span className="font-mono text-slate-400">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* APLICAR DESCUENTO */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 mb-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-pink-400 flex items-center gap-1.5 uppercase">
                      <Tag className="w-3.5 h-3.5" /> Aplicar Descuento
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setDiscountType("monto")}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${discountType === "monto" ? "bg-pink-500 text-white" : "text-slate-400"}`}
                      >
                        Monto ($)
                      </button>
                      <button
                        onClick={() => setDiscountType("porcentaje")}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${discountType === "porcentaje" ? "bg-pink-500 text-white" : "text-slate-400"}`}
                      >
                        Porcentaje (%)
                      </button>
                    </div>
                  </div>

                  <input
                    type="number"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="Ej: 2000 o 10"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black text-white font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* TOTALES FINALIZADOS */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">${subtotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-rose-400">
                    <span>Descuento aplicado:</span>
                    <span className="font-mono">-${discountVal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>TOTAL FINAL:</span>
                    <span className="font-mono">${finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* MÉTODOS DE PAGO Y CAMBIO */}
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-3 gap-2">
                    {(["efectivo", "nequi", "tarjeta"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-xl text-xs font-black uppercase transition-all border ${
                          paymentMethod === m ? "bg-pink-500 text-white border-pink-400" : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "efectivo" && (
                    <div className="space-y-1">
                      <input
                        type="number"
                        placeholder="Monto recibido en efectivo..."
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black text-white font-mono"
                      />
                      {Number(cashReceived) >= finalTotal && (
                        <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs font-black text-emerald-400 flex justify-between">
                          <span>Cambio:</span>
                          <span className="font-mono">${(Number(cashReceived) - finalTotal).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFinalizeSale}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black uppercase text-xs rounded-2xl shadow-lg cursor-pointer active:scale-95"
                >
                  ✅ Cobrar y Finalizar Venta
                </button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h3 className="font-black text-xl text-white">¡Venta Registrada y Stock Descontado!</h3>
                <button
                  onClick={() => { setShowCheckout(false); setSelectedMesa(null); }}
                  className="w-full py-3 bg-pink-500 text-white font-black uppercase text-xs rounded-2xl"
                >
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