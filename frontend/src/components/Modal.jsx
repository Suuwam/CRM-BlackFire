export default function Modal({ open, onClose, title, children, footer, large, wide }) {
  if (!open) return null;
  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${large ? ' modal-lg' : ''}${wide ? ' modal-xl' : ''}`}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
