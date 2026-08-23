import { X } from "lucide-react"; import type { ReactNode } from "react";
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="overlay" role="dialog"><section className="modal"><header><h2>{title}</h2><button className="icon" onClick={onClose}><X/></button></header>{children}</section></div>}
