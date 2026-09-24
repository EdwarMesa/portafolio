# Diagrama de flujo – App de registro de miembros de la iglesia

La app guarda estos datos de cada persona: nombre, sexo (hombre o mujer),
edad, teléfono, si ya se le hizo visita y si está activa en la iglesia.

GitHub dibuja el diagrama automáticamente (también está como imagen en
[`diagrama-flujo.png`](diagrama-flujo.png)). También puedes copiar el bloque
`mermaid` en <https://mermaid.live> para verlo, editarlo o exportarlo como imagen.

```mermaid
flowchart TD
    A([Inicio]) --> B[/Mostrar menú principal/]
    B --> C{¿Qué opción elige?}

    %% ---------- 1. Registrar persona ----------
    C -->|1. Registrar persona| R1[/Ingresar nombre completo/]
    R1 --> R2{¿Sexo?}
    R2 -->|Hombre| R3[sexo = H]
    R2 -->|Mujer| R4[sexo = M]
    R3 --> R5[/Ingresar fecha de nacimiento/]
    R4 --> R5
    R5 --> R6[Calcular edad]
    R6 --> R7[/Ingresar teléfono/]
    R7 --> R8{¿Teléfono válido?<br/>solo números, 10 dígitos}
    R8 -->|No| R9[/Mostrar: teléfono inválido/] --> R7
    R8 -->|Sí| R10{¿Ya existe una persona<br/>con ese teléfono?}
    R10 -->|Sí| R11[/Mostrar: persona ya registrada/] --> B
    R10 -->|No| R12{¿Ya se le hizo visita?}
    R12 -->|Sí| R13[/Ingresar fecha de la visita/] --> R14[visitado = Sí]
    R12 -->|No| R15[visitado = No]
    R14 --> R16{¿Asiste activamente<br/>a la iglesia?}
    R15 --> R16
    R16 -->|Sí| R17[activo = Sí]
    R16 -->|No| R18[activo = No]
    R17 --> R19[(Guardar en la base de datos)]
    R18 --> R19
    R19 --> R20[/Mostrar: registro guardado/] --> B

    %% ---------- 2. Buscar / actualizar ----------
    C -->|2. Buscar persona| S1[/Ingresar nombre o teléfono/]
    S1 --> S2[(Buscar en la base de datos)]
    S2 --> S3{¿Se encontró?}
    S3 -->|No| S4[/Mostrar: no encontrado/] --> B
    S3 -->|Sí| S5[/Mostrar datos de la persona/]
    S5 --> S6{¿Desea actualizar<br/>visita o estado?}
    S6 -->|No| B
    S6 -->|Sí| S7[/Marcar visita realizada<br/>y/o cambiar activo - inactivo/]
    S7 --> S8[(Actualizar registro)] --> B

    %% ---------- 3. Reportes ----------
    C -->|3. Ver reportes| P1{¿Qué reporte?}
    P1 -->|Por sexo| P2[Contar hombres y mujeres]
    P1 -->|Por edad| P3[Agrupar: niños 0-12,<br/>jóvenes 13-29, adultos 30-59,<br/>adultos mayores 60+]
    P1 -->|Pendientes de visita| P4[Listar personas con<br/>visitado = No]
    P1 -->|Inactivos| P5[Listar personas con<br/>activo = No, con teléfono]
    P2 --> P6[/Mostrar reporte/]
    P3 --> P6
    P4 --> P6
    P5 --> P6
    P6 --> B

    %% ---------- 4. Salir ----------
    C -->|4. Salir| Z([Fin])
```

## Qué hace cada parte

| Símbolo | Significado |
|---|---|
| Óvalo `([ ])` | Inicio o fin |
| Rectángulo `[ ]` | Proceso (el sistema hace algo) |
| Paralelogramo `[/ /]` | Entrada o salida (el usuario escribe o el sistema muestra) |
| Rombo `{ }` | Decisión (Sí / No u opciones) |
| Cilindro `[( )]` | Base de datos |

1. **Registrar persona**: se piden el nombre, el sexo, la fecha de nacimiento
   (la edad se calcula sola), el teléfono (se valida y se revisa que no
   exista ya), si ya se le visitó y si está activa. Luego se guarda.
2. **Buscar persona**: se busca por nombre o teléfono y se puede marcar la
   visita como realizada o cambiar el estado de activo o inactivo.
3. **Reportes**: cuántos hombres y mujeres hay, cuántas personas hay por rango
   de edad, quiénes faltan por visitar y quiénes están inactivos (con su
   teléfono, para llamarlos).
4. **Salir**.
