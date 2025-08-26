export interface Article {
  _id?: string;                     
  tema?: string;                    
  subtemas?: string[];              
  sin_categoria?: boolean;          
  contenidos?: string[];  
  ref_tabla_nivel0?: string | null; 
  ref_tabla_nivel1?: string | null;
  ref_tabla_nivel2?: string | null;
  ref_tabla_nivel3?: string | null; 

  fecha_creacion?: Date | null;     
  fecha_modificacion?: Date | null; 
} 
export interface User {
  username: string;
  isAuthenticated: boolean;
} 