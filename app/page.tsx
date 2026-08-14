"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
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
  DollarSign,
  UtensilsCrossed,
} from "lucide-react";

// Tipos de datos
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
}

interface CartItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
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
    productos: { nombre: string };
  }[];
}

export default function HomePOS() {
  // Vista principal: Mesero por defecto para rapidez de comanda
  const [vista, setVista] = useState<ModoVista>("mesero");

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidosCocina, setPedidosCocina] = useState<PedidoCocina[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  // Filtros de menú
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Comanda/Carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activePedidoId, setActivePedidoId] = useState<number | null>(null);

  // Drawer Móvil
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Checkout Caja
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi" | "tarjeta">("efectivo");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  // Cargar datos
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase
        .from("mesas")
        .select("*")
        .order("numero", { ascending: true });

      const { data: prodData } = await supabase
        .from("productos")
        .select("*")
        .order("id", { ascending: true });

      if (mesasData && mesasData.length > 0) {
        setMesas(mesasData as Mesa[]);
      } else {
        setMesas([
          { id: 1, numero: 1, nombre: "Mesa 1", estado: "libre", capacidad: 4 },
          { id: 2, numero: 2, nombre: "Mesa 2", estado: "libre", capacidad: 4 },
          { id: 3, numero: 3, nombre: "Mesa 3", estado: "libre", capacidad: 2 },
          { id: 4, numero: 4, nombre: "Mesa 4", estado: "libre", capacidad: 6 },
          { id: 5, numero: 5, nombre: "Mesa 5", estado: "libre", capacidad: 4 },
          { id: 6, numero: 6, nombre: "Mesa 6", estado: "libre", capacidad: 2 },
          { id: 7, numero: 7, nombre: "Mesa 7", estado: "libre", capacidad: 4 },
          { id: 8, numero: 8, nombre: "Mesa 8", estado: "libre", capacidad: 8 },
        ]);
      }

      if (prodData && prodData.length > 0) setProductos(prodData);
      else {
        setProductos([
          { id: 1, nombre: "Helado 1 Bola", categoria: "Helados", precio: 4500, descripcion: "Sabor a elección", disponible: true },
          { id: 2, nombre: "Helado 2 Bolas", categoria: "Helados", precio: 8000, descripcion: "Dos sabores a elección", disponible: true },
          { id: 3, nombre: "Copa Especial Heladería", categoria: "Especiales", precio: 15000, descripcion: "3 Bolas, crema y salsa", disponible: true },
          { id: 4, nombre: "Banana Split", categoria: "Especiales", precio: 18000, descripcion: "Banano, 3 bolas, cereza y crema", disponible: true },
          { id: 5, nombre: "Topping Chispas / Gomitas", categoria: "Toppings", precio: 1500, descripcion: "Porción adicional", disponible: true },
          { id: 6, nombre: "Salsa de Chocolate / Arequipe", categoria: "Toppings", precio: 2000, descripcion: "Porción adicional", disponible: true },
          { id: 7, nombre: "Agua Mineral", categoria: "Bebidas", precio: 3000, descripcion: "Botella 500ml", disponible: true },
          { id: 8, nombre: "Malteada", categoria: "Bebidas", precio: 12000, descripcion: "Sabor a elección con leche", disponible: true },
        ]);
      }

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

  // Seleccionar Mesa
  const handleSelectMesa = async (mesa: Mesa) => {
    // Si estamos en caja, directamente abrimos el modal de cobro sin pasar al menú de productos
    if (vista === "caja") {
      if (mesa.estado === "libre") return; // En caja no se cobra una mesa libre
      setSelectedMesa(mesa);
      setShowCheckout(true);
      return;
    }

    // Modo Mesero:
    setSelectedMesa(mesa);
    setCart([]);
    setActivePedidoId(null);
    setShowCheckout(false);
    setSaleCompleted(false);
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
        }));
        setCart(loadedCart);
      }
    }
  };

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1 }];
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

  const totalAmount = useMemo(() => cart.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0), [cart]);
  const totalItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.cantidad, 0), [cart]);

  // Enviar a Cocina (Mesero)
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
        .insert({ mesa_id: selectedMesa.id, total: totalAmount, estado: "abierto", estado_pedido: "pendiente_servir" })
        .select()
        .single();
      pedido = newPedido;
    } else {
      await supabase.from("pedidos").update({ total: totalAmount, estado_pedido: "pendiente_servir" }).eq("id", pedido.id);
      await supabase.from("pedido_items").delete().eq("pedido_id", pedido.id);
    }

    if (pedido && cart.length > 0) {
      const itemsToInsert = cart.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
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

  const handleFinalizeSale = async () => {
    if (!selectedMesa) return;

    await supabase.from("ventas").insert({
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: paymentMethod,
      total: totalAmount,
    });

    await supabase
      .from("pedidos")
      .update({ estado: "pagado", estado_pedido: "servido" })
      .eq("mesa_id", selectedMesa.id)
      .eq("estado", "abierto");

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
      {/* HEADER PRINCIPAL RESPONSIVO */}
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

        {/* NAVEGACIÓN BANDERAS PRINCIPALES (BOTONES TÁCTILES MÁS GRANDES Y CÓMODOS) */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/90 w-full md:w-auto justify-center">
          <button
            onClick={() => { setVista("caja"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 ${
              vista === "caja" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] border border-pink-400" : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> CAJA
          </button>

          <button
            onClick={() => { setVista("mesero"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 ${
              vista === "mesero" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] border border-pink-400" : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> MESERO
          </button>

          <button
            onClick={() => { setVista("cocina"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 relative ${
              vista === "cocina" ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300" : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <ChefHat className="w-4 h-4" /> COCINA
            {pedidosCocina.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />
            )}
          </button>
        </div>

        <button
          onClick={fetchData}
          className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-black text-cyan-300 transition-all cursor-pointer active:scale-95 shadow"
        >
          🔄 Sincronizar
        </button>
      </header>

      {/* ---------------- VISTA COCINA ---------------- */}
      {vista === "cocina" && (
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ChefHat className="w-7 h-7 text-amber-400" /> Pedidos por Preparar ({pedidosCocina.length})
            </h2>
          </div>

          {pedidosCocina.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-bold text-sm sm:text-base bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
              🍳 No hay comandas pendientes en cocina.
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
                        <div key={it.id} className="flex justify-between items-center text-sm font-bold text-slate-100 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                          <span>{it.cantidad}x {it.productos?.nombre}</span>
                          {it.notas && <span className="text-amber-400 italic text-xs">({it.notas})</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCocinaListo(p.id, p.mesa_id)}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95"
                  >
                    <Check className="w-5 h-5" /> Marcar como Preparado
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ---------------- VISTAS CAJA Y MESERO ---------------- */}
      {vista !== "cocina" && (
        <>
          {!selectedMesa ? (
            <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
              {/* LEYENDA ESTADOS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-slate-900/80 p-4 rounded-2xl border border-slate-800/90 backdrop-blur shadow-xl">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-black">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" /><span className="text-slate-300">Libre</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse" /><span className="text-slate-300">En Cocina</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-bounce" /><span className="text-slate-300">¡Listo!</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" /><span className="text-slate-300">Servido</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" /><span className="text-slate-300">Por Pagar</span></div>
                </div>

                <div className="text-xs font-extrabold text-slate-400">
                  Modo Activo: <span className="text-pink-400 font-black uppercase">{vista}</span>
                </div>
              </div>

              {/* GRID DE MESAS */}
              {loading ? (
                <div className="text-center py-20 text-slate-400 font-bold animate-pulse text-sm">
                  Cargando estado del salón...
                </div>
              ) : (
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
                        className={`group relative rounded-3xl p-4 sm:p-5 border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-xl active:scale-95 ${
                          isLibre
                            ? "bg-slate-900/80 border-emerald-500/30 hover:border-emerald-400"
                            : isPendServir
                            ? "bg-amber-950/20 border-amber-400/60 hover:border-amber-300"
                            : isPreparado
                            ? "bg-purple-950/30 border-purple-500 hover:border-purple-400"
                            : isServido
                            ? "bg-cyan-950/20 border-cyan-400/60 hover:border-cyan-300"
                            : "bg-rose-950/20 border-rose-500/60 hover:border-rose-400"
                        }`}
                      >
                        <div className="flex justify-between items-center z-10">
                          <h3 className="font-black text-lg sm:text-2xl text-white tracking-wide">
                            {mesa.nombre}
                          </h3>
                          <span
                            className={`text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              isLibre
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : isPendServir
                                ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse"
                                : isPreparado
                                ? "bg-purple-500/30 text-purple-300 border border-purple-400 animate-bounce"
                                : isServido
                                ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            }`}
                          >
                            {isLibre && "Libre"}
                            {isPendServir && "En Cocina"}
                            {isPreparado && "¡Listo!"}
                            {isServido && "Servido"}
                            {isPendPago && "Por Pagar"}
                          </span>
                        </div>

                        <div className="flex-1 flex justify-center items-center my-1 relative">
                          <img
                            src={isLibre ? "/mesa1.png" : "/mesa2.png"}
                            alt={mesa.nombre}
                            className="h-24 sm:h-32 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>

                        {/* ACCIONES MESA SEGÚN VISTA */}
                        <div className="z-10 pt-2 border-t border-slate-800/80 flex flex-col gap-1">
                          {vista === "caja" ? (
                            <button className="w-full py-1.5 bg-pink-500/20 text-pink-300 border border-pink-500/40 font-black text-xs rounded-xl">
                              {isLibre ? "Mesa Libre" : "💳 Cobrar Mesa"}
                            </button>
                          ) : (
                            <>
                              {isPreparado && (
                                <button
                                  onClick={(e) => handleCambiarEstadoMesa(mesa.id, "servido", e)}
                                  className="w-full py-1.5 bg-purple-500 text-slate-950 font-black text-[11px] rounded-xl shadow flex items-center justify-center gap-1"
                                >
                                  🔔 Servir Pedido
                                </button>
                              )}
                              {isServido && (
                                <button
                                  onClick={(e) => handleCambiarEstadoMesa(mesa.id, "pendiente_pago", e)}
                                  className="w-full py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black text-[11px] rounded-xl"
                                >
                                  Pedir Cuenta
                                </button>
                              )}
                              {isLibre && (
                                <div className="text-[10px] font-black text-center text-emerald-400 py-1">
                                  + Toca para Tomar Pedido
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          ) : (
            /* COMANDA INTERACTIVA DE MESERO (LISTA + TOTALES + ENVIAR A COCINA) */
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 pb-32 lg:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedMesa(null)}
                    className="self-start px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-black text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-pink-400" /> Salón de Mesas
                  </button>

                  <div className="relative flex-1 w-full sm:max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategory === cat
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                          : "bg-slate-900 border border-slate-800 text-slate-400"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* GRID DE SELECCIÓN DE PRODUCTOS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="bg-slate-900/90 border border-slate-800 hover:border-pink-500/50 p-4 rounded-3xl cursor-pointer transition-all flex flex-col justify-between group active:scale-95 shadow-lg"
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full">
                          {p.categoria}
                        </span>
                        <h4 className="font-black text-sm text-white mt-2 group-hover:text-pink-300">
                          {p.nombre}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {p.descripcion}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-slate-800 flex justify-between items-center">
                        <span className="font-black text-sm text-emerald-400 font-mono">
                          ${p.precio.toLocaleString()}
                        </span>
                        <span className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white flex items-center justify-center font-black text-lg">
                          +
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BARRA INFERIOR PERSISTENTE PARA CELULARES Y TABLETS */}
              <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 border-t-2 border-pink-500/50 p-3.5 shadow-[0_-10px_30px_rgba(0,0,0,0.9)] backdrop-blur-lg">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
                    className="flex items-center gap-3 bg-slate-950 px-3.5 py-2.5 rounded-2xl border border-slate-800 flex-1 cursor-pointer active:scale-95"
                  >
                    <ShoppingBag className="w-5 h-5 text-pink-400" />
                    <div className="text-left">
                      <span className="text-[10px] font-black text-slate-400 block uppercase">
                        Ver Comanda ({totalItemsCount})
                      </span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        ${totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <ChevronUp className={`w-5 h-5 text-slate-400 ml-auto transition-transform ${isMobileCartOpen ? "rotate-180" : ""}`} />
                  </button>

                  <button
                    onClick={handleSaveOrder}
                    disabled={cart.length === 0}
                    className="px-5 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase rounded-2xl cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center gap-2 active:scale-95"
                  >
                    <ChefHat className="w-4 h-4" /> Enviar a Cocina
                  </button>
                </div>
              </div>

              {/* PANEL DERECHO / ESCRITORIO / Y DRAWER DESPLEGABLE MÓVIL DE LA COMANDA */}
              <div
                className={`w-full lg:w-96 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl transition-all duration-300 fixed lg:relative bottom-0 inset-x-0 z-50 lg:z-auto ${
                  isMobileCartOpen ? "h-[80vh] lg:h-auto" : "hidden lg:flex"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="font-black text-lg text-white flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-pink-400" /> {selectedMesa.nombre}
                      </h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Comanda para Cocina
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-pink-400 bg-pink-500/10 px-3 py-1 rounded-full">
                        {totalItemsCount} Ítems
                      </span>
                      <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* LISTA DE ITEMS REGISTRADOS */}
                  <div className="my-4 space-y-3 max-h-[45vh] lg:max-h-[50vh] overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 font-bold text-xs flex flex-col items-center gap-2">
                        <ShoppingBag className="w-8 h-8 opacity-40 text-slate-400" />
                        Añade helados o bebidas para enviar la comanda.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.producto.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                          <div className="flex-1 pr-2">
                            <h5 className="font-black text-xs text-slate-100">{item.producto.nombre}</h5>
                            <p className="text-[11px] text-slate-400 font-mono">${item.producto.precio.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(item.producto.id, -1)} className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 font-black flex items-center justify-center cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="font-black text-xs text-white w-5 text-center">{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.producto.id, 1)} className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 font-black flex items-center justify-center cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* RESUMEN DE TOTALES Y BOTÓN DE ENVIAR A COCINA (NADA DE BOTONES DE COBRO AQUÍ) */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                    <span>Subtotal Comanda</span>
                    <span className="font-mono text-slate-200">${totalAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-lg font-black text-white">
                    <span>TOTAL ESTIMADO</span>
                    <span className="font-mono text-emerald-400 text-xl">${totalAmount.toLocaleString()}</span>
                  </div>

                  <button
                    onClick={handleSaveOrder}
                    disabled={cart.length === 0}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm uppercase rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all active:scale-95"
                  >
                    <ChefHat className="w-5 h-5" /> Enviar a Cocina
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DE COBRO DE CAJA */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    💳 Cobrar - {selectedMesa.nombre}
                  </h3>
                  <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Total a Cobrar</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">${totalAmount.toLocaleString()}</span>
                </div>

                <div className="space-y-2 mb-5">
                  <label className="text-xs font-black text-slate-300 uppercase block">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["efectivo", "nequi", "tarjeta"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                          paymentMethod === m ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.4)]" : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "efectivo" && (
                  <div className="mb-5 space-y-2">
                    <label className="text-xs font-black text-slate-300 uppercase block">Monto Recibido</label>
                    <input
                      type="number"
                      placeholder="Ej: 20000"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-base font-black text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                    {Number(cashReceived) >= totalAmount && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs font-black text-emerald-400 flex justify-between">
                        <span>Cambio a Entregar:</span>
                        <span className="font-mono">${(Number(cashReceived) - totalAmount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleFinalizeSale}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black uppercase text-xs sm:text-sm rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95 transition-all"
                >
                  ✅ Confirmar y Liberar Mesa
                </button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="font-black text-xl text-white">¡Venta Finalizada!</h3>
                <p className="text-xs text-slate-400 font-semibold">La mesa {selectedMesa.nombre} ha sido liberada correctamente.</p>
                <button
                  onClick={() => {
                    setShowCheckout(false);
                    setSelectedMesa(null);
                    setIsMobileCartOpen(false);
                  }}
                  className="w-full py-3 bg-pink-500 text-white font-black uppercase text-xs sm:text-sm rounded-2xl shadow cursor-pointer active:scale-95 transition-all"
                >
                  Volver al Mapa de Mesas
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}