import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Resizable } from "re-resizable";

// Grade de caixas arrastáveis (reordenar, via @dnd-kit) e redimensionáveis
// em qualquer direção (via re-resizable) — a pedido do usuário, pra
// personalizar o cabeçalho do processo. Testado que funciona no React 19:
// react-grid-layout (a opção mais óbvia) depende do react-draggable
// vendorizado sem `nodeRef`, e quebra em runtime porque
// ReactDOM.findDOMNode foi removido no React 19. dnd-kit e re-resizable não
// dependem de findDOMNode.
//
// Fora do modo de edição, é só um flex-wrap normal com a ordem/tamanho
// salvos (sem handles, sem D&D ativo) — nenhuma caixa nunca arrastada fica
// exatamente como antes (tamanho automático pelo conteúdo).
const ALL_HANDLES = { top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true };
const HANDLE_STYLE = { background: "var(--brand)", opacity: 0.55, borderRadius: 3 };
const HANDLE_STYLES = {
  top: { ...HANDLE_STYLE, height: 4, top: -2 },
  bottom: { ...HANDLE_STYLE, height: 4, bottom: -2 },
  left: { ...HANDLE_STYLE, width: 4, left: -2 },
  right: { ...HANDLE_STYLE, width: 4, right: -2 },
  topLeft: { ...HANDLE_STYLE, width: 10, height: 10, top: -4, left: -4 },
  topRight: { ...HANDLE_STYLE, width: 10, height: 10, top: -4, right: -4 },
  bottomLeft: { ...HANDLE_STYLE, width: 10, height: 10, bottom: -4, left: -4 },
  bottomRight: { ...HANDLE_STYLE, width: 10, height: 10, bottom: -4, right: -4 },
};

function SortableBox({ id, editMode, size, onResizeStop, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });
  const wrapStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : "auto",
  };

  // Fora do modo de edição, o tamanho salvo ainda precisa valer (só sem
  // handles/D&D ativos) — senão uma caixa redimensionada volta ao tamanho
  // automático assim que sai do modo de reorganizar.
  if (!editMode) {
    return (
      <div ref={setNodeRef} style={{ ...wrapStyle, width: size.width, height: size.height }}>
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={wrapStyle}>
      <button
        type="button"
        {...attributes} {...listeners}
        title="Arrastar para mover"
        style={{
          position: "absolute", top: -11, left: -11, zIndex: 6, cursor: "grab",
          background: "var(--brand)", color: "#fff", border: "none", borderRadius: 6,
          width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, lineHeight: 1, padding: 0, touchAction: "none",
        }}
      >
        ⠿
      </button>
      <Resizable
        size={size}
        minWidth={140}
        minHeight={32}
        enable={ALL_HANDLES}
        handleStyles={HANDLE_STYLES}
        onResizeStop={(_e, _dir, ref) => onResizeStop({ width: ref.offsetWidth, height: ref.offsetHeight })}
        style={{ outline: "1px dashed rgba(var(--brand-rgb),.6)", borderRadius: 8 }}
      >
        {children}
      </Resizable>
    </div>
  );
}

// boxes: { [id]: reactNode }. order: string[] (ids). sizes: { [id]: {width,height} }.
export function HeaderLayoutGrid({ boxes, editMode, order, sizes, onChangeOrder, onChangeSize }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = order.filter((id) => boxes[id] != null);

  function handleDragEnd(ev) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChangeOrder(arrayMove(ids, oldIndex, newIndex));
  }

  const grid = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
      {ids.map((id) => {
        const s = sizes[id];
        return (
          <SortableBox
            key={id} id={id} editMode={editMode}
            size={s ? { width: s.width, height: s.height } : { width: "auto", height: "auto" }}
            onResizeStop={(sz) => onChangeSize(id, sz)}
          >
            {boxes[id]}
          </SortableBox>
        );
      })}
    </div>
  );

  if (!editMode) return grid;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}
