# ACM Tools — Manual de Usuario

> Versión del aplicativo: 2025 · Roles: Administrador, Jefe/Supervisor, Operario

---

## Índice

1. [¿Qué es ACM Tools?](#1-qué-es-acm-tools)
2. [Acceso y Login](#2-acceso-y-login)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Navegación general](#4-navegación-general)
5. [Perfil de Operario — Módulos de registro](#5-perfil-de-operario--módulos-de-registro)
   - [01 Incidencias](#01-incidencias)
   - [02 Control de Calidad](#02-control-de-calidad)
   - [03 Visitas](#03-visitas)
   - [04 Limpieza](#04-limpieza)
   - [05 Horas Improductivas](#05-horas-improductivas)
   - [06 ISSUS](#06-issus)
   - [07 KPI Mensual](#07-kpi-mensual)
6. [Mis Registros](#6-mis-registros)
7. [Informes (PDF)](#7-informes-pdf)
8. [Panel de Administración](#8-panel-de-administración)
   - [Dashboard general](#dashboard-general)
   - [KPI Mensual (vista global)](#kpi-mensual-vista-global)
   - [Permisos y Roles](#permisos-y-roles)
   - [Operarios](#operarios)
   - [Jefes](#jefes)
   - [Usuarios Operario](#usuarios-operario)
   - [Configuración](#configuración)
9. [Sincronización con n8n](#9-sincronización-con-n8n)
10. [Preguntas frecuentes](#10-preguntas-frecuentes)

---

## 1. ¿Qué es ACM Tools?

ACM Tools es una aplicación de gestión de KPIs y registros para equipos técnicos. Permite a los operarios registrar su actividad diaria en seis módulos (incidencias, calidad, visitas, limpieza, horas improductivas e ISSUS) y calcular automáticamente los incentivos mensuales a través de la hoja de KPI.

Los supervisores (jefes) gestionan y consultan los datos de sus operarios asignados. El administrador controla la configuración global del sistema.

---

## 2. Acceso y Login

### Pantalla de inicio de sesión

Al abrir la aplicación se muestra la pantalla de login:

1. **Nombre** — Introduce tu nombre de usuario tal como fue creado por el administrador.
2. **PIN** — Introduce el PIN de 4 dígitos asignado.
3. Pulsa **Entrar**.

### Redirección según rol

| Rol | Destino tras login |
|-----|-------------------|
| Administrador | Panel de Administración (`/admin`) |
| Jefe/Supervisor | Selector de operarios (`/seleccionar-operario`) |
| Operario | Su propio perfil (`/operario/[nombre]`) |

> **Nota:** Si introduces un nombre o PIN incorrecto, el sistema no permite el acceso. Contacta con el administrador para recuperar o restablecer tu PIN.

---

## 3. Roles y permisos

El sistema tiene tres roles. Cada uno tiene acceso a distintas secciones y funcionalidades.

### Administrador

- Acceso completo a todas las páginas y operarios.
- Gestiona usuarios, jefes, operarios y la configuración del sistema.
- Puede ver y modificar datos de cualquier operario.
- Accede al Panel de Administración con todas sus pestañas.
- Puede configurar los permisos predeterminados para jefes y operarios.

### Jefe / Supervisor

- Accede a la lista de operarios asignados a su cargo.
- Puede rellenar y editar los módulos de registro (pestañas 01–06) de sus operarios.
- Vista de solo lectura en los perfiles de operarios asignados a otros jefes.
- Puede generar informes PDF del mes de sus operarios.
- Puede consultar los registros del mes en "Mis Registros".

### Operario

- Solo puede acceder a su propio perfil.
- Puede rellenar todos los módulos del mes en curso.
- Los meses anteriores en el KPI Mensual son de solo lectura.
- Puede consultar sus propios registros del mes en "Mis Registros".
- No tiene acceso a informes ni al panel de administración.

---

## 4. Navegación general

### Barra de navegación superior

La barra aparece en todas las páginas tras iniciar sesión. Muestra:

- **Logo y nombre de la empresa** (configurable por el administrador).
- **Nombre del usuario y rol** (izquierda).
- **Menú de navegación** (derecha), adaptado al rol:

| Rol | Enlaces disponibles |
|-----|---------------------|
| Administrador | Admin |
| Jefe | Operarios · Mis Registros · Informes |
| Operario | Mis KPIs · Mis Registros |

- **Botón Cerrar sesión** (siempre visible en la esquina derecha).

### Perfil de un operario

Al navegar a un operario (desde el selector o directamente), la página muestra:

- **Flecha atrás** → vuelve al selector de operarios (no aparece para el rol operario).
- **Nombre del operario** y subtítulo indicando el modo: "Mis registros", "Gestión de registros del operario" o "Vista de solo lectura".
- **7 pestañas de registro** (01–07).

---

## 5. Perfil de Operario — Módulos de registro

Cada módulo muestra los registros del **mes en curso** y un formulario para añadir nuevos. Los datos se guardan en Supabase y se sincronizan automáticamente con n8n si está configurado.

> **Vista de solo lectura:** Cuando un jefe accede a un operario de otro jefe, el formulario de entrada y el botón de eliminar están ocultos. Solo puede consultar los datos.

---

### 01 Incidencias

Registro de incidencias del operario con su puntuación asociada.

**Campos del formulario:**

| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha de la incidencia (por defecto hoy) |
| ID Incidencia | Número de referencia interno (opcional) |
| OT | Número de orden de trabajo (opcional) |
| Incidencia | Tipo de incidencia (desplegable) |
| Puntos | Puntuación numérica de la incidencia |
| Observaciones | Texto libre (opcional) |

**Tabla de registros:** muestra Fecha, ID, OT, Tipo, Puntos, Observaciones y botón de eliminar.

---

### 02 Control de Calidad

Registro de incidencias de calidad atendidas por el operario.

**Campos del formulario:**

| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha del registro |
| OT | Orden de trabajo (opcional) |
| Cliente | Nombre del cliente |
| Tipo CQ | Tipo de control de calidad |
| Descripción | Descripción del problema |
| Resolución | Cómo se resolvió (opcional) |
| Marca | Marca del equipo (opcional) |
| Horas | Horas dedicadas |
| Importe/h | Coste por hora (€) |
| Materiales | Coste de materiales (€) |

El campo **Total CQ** se calcula automáticamente: `(Horas × Importe/h) + Materiales`.

---

### 03 Visitas

Registro de visitas de inspección realizadas.

**Campos del formulario:**

| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha de la visita |
| Tipo Visita | Categoría de visita (desplegable) |
| Inspección | Descripción de lo inspeccionado |
| OT | Orden de trabajo (opcional) |
| OK / KO | Estado del resultado de la visita |
| Cliente | Nombre del cliente (opcional) |
| Observaciones | Texto libre (opcional) |

---

### 04 Limpieza

Registro de revisiones de limpieza, vestuario y seguridad.

**Campos del formulario:**

| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha del registro |
| Vestuario H | Puntuación de vestuario y higiene |
| Limpieza VH | Puntuación de limpieza del vehículo |
| Limpieza VH Sorpresa | Puntuación de inspección sorpresa |
| Seguridad T | Puntuación de seguridad |
| Herramientas | Puntuación de herramientas |
| Observaciones | Texto libre (opcional) |

---

### 05 Horas Improductivas

Registro de las horas dedicadas a tareas no productivas y consumibles.

**Campos del formulario:**

| Campo | Objetivo orientativo |
|-------|---------------------|
| H. Recogida Material | Obj: 1,5 h |
| H. Reunión | Obj: 1 h |
| H. Mant. Furgonetas | Obj: 2 h/mes |
| H. Mant. Instalaciones | — |
| H. Formación | — |
| Consumibles € | — |
| Observaciones | Texto libre (opcional) |

El **Total de horas** (suma de todas las horas excepto consumibles) se calcula y muestra en tiempo real antes de guardar.

---

### 06 ISSUS

Registro de acciones, no conformidades y correctivas del sistema de calidad.

**Campos del formulario:**

| Campo | Descripción |
|-------|-------------|
| Fecha | Fecha del registro |
| ID | Número de referencia ISSUS (opcional) |
| Tipo | ACCION MEJORA / NO CONFORMIDAD / CORRECTIVA / INCIDENCIA |
| Estado | ABIERTA / CERRADA (botones de selección) |
| Descripción | Descripción detallada * (obligatorio) |

El estado **ABIERTA** se muestra en verde y **CERRADA** en rojo tanto en el formulario como en la tabla.

---

### 07 KPI Mensual

La pestaña más completa. Replica exactamente la hoja de cálculo de incentivos con los 12 meses del año.

> **Importante:** Los datos del KPI Mensual se guardan en el **navegador local** (localStorage), no en Supabase. Si se accede desde un dispositivo diferente, los datos no estarán disponibles.

#### Tabla principal (12 meses)

Cada fila representa un mes. Los campos azules son editables, los demás se calculan automáticamente.

| Sección | Campos editables | Calculado automáticamente |
|---------|-----------------|--------------------------|
| **Productividad** | % Objetivo (80–120) | Importe · Acumulado |
| **Control Documental** | Puntos (−80 a 80) | Importe · Acumulado |
| **Control Visitas** | Estado (OK / KO) | Importe · Acumulado |
| **Retorno** | % Retorno (libre) | %P−%R · Importe · Acumulado |
| **Herramientas** | Estado (OK / KO) | Importe · Acumulado |
| **Vehículo** | Estado (OK / KO) | Importe · Acumulado |
| **Aseo personal** | Estado (OK / KO) | Importe · Acumulado |
| **Horas Improductivas** | H. Objetivo · H. Invertidas | Diferencia · % · Penalización |
| **TOTAL** | — | Suma de todos los importes menos penalización |

> La **Productividad** se muestra como referencia pero **no se incluye en el TOTAL**.

**Navegación por año:** Los botones ← → en la cabecera permiten cambiar de año. El mes actual se resalta en azul.

**Guardado automático:** Cada cambio se guarda al instante en el navegador.

#### Resumen de Incentivos

Debajo de la tabla principal aparece el resumen con:

| Columna | Descripción |
|---------|-------------|
| Importe | TOTAL del mes (de la tabla principal) |
| Acumulado | Suma acumulada hasta ese mes |
| Imp. a Cobrar | MAX(Importe − KPI Referencia, 0) |
| Objetivo | Objetivo mensual a cobrar (editable, por defecto 250 €) |
| Dietas | Dietas del mes (editable) |
| H. Ext | Horas extra del mes (editable) |

**KPI Referencia (umbral):** Valor a partir del cual se empiezan a cobrar incentivos. Se configura por año y operario en el campo de la cabecera del resumen.

**Filas de totales:**
- **TOTAL** — Suma de los 12 meses.
- **TOTAL (P)** — Suma solo de los meses con importe positivo.
- **% OBJETIVO** — `Imp. a Cobrar total ÷ Objetivo (meses P) × 100`.

#### Tablas de referencia

Al final de la pestaña hay una sección desplegable con las tablas exactas de conversión utilizadas en los cálculos (Productividad, Control Documental, Visitas, Herramientas, Vehículo, Aseo, Retorno y fórmula de penalización).

---

## 6. Mis Registros

Accesible desde el menú de navegación para jefes y operarios.

Muestra todos los registros del **mes en curso** de los módulos 01–06 (no incluye KPI Mensual).

### Filtros disponibles

- **Sección** — Filtra por módulo (Incidencias, Control Calidad, Visitas, Limpieza, Horas Improductivas, ISSUS) o muestra todos.
- **Operario** — Solo disponible para jefes; filtra por operario asignado.

### Columnas de la tabla

- Fecha · Tipo/Módulo · Operario · Descripción/Detalle · Estado de sincronización (✓ sincronizado / ⏳ pendiente).

---

## 7. Informes (PDF)

Accesible para **jefes y administradores** desde el menú de navegación.

Permite generar un informe PDF del KPI mensual de un operario.

### Pasos para generar un informe

1. Selecciona el **operario** en el desplegable.
2. Selecciona el **mes** y el **año**.
3. Pulsa **Vista previa** para ver el informe en pantalla antes de descargar.
4. Pulsa **Descargar PDF** para guardar el archivo.

### Contenido del informe

El PDF incluye 9 secciones:
1. Cabecera con nombre del operario, mes y año.
2. Tabla KPI Mensual completa.
3. Resumen de Incentivos.
4. Incidencias del mes.
5. Control de Calidad del mes.
6. Visitas del mes.
7. Limpieza del mes.
8. Horas Improductivas del mes.
9. ISSUS del mes.

> **Nota:** Los datos del KPI Mensual (tabla principal y resumen) proceden del navegador local. Los datos de los módulos 01–06 se obtienen de Supabase.

---

## 8. Panel de Administración

Solo accesible para el rol **Administrador**. Contiene 7 pestañas.

---

### Dashboard general

Vista consolidada de todos los módulos de todos los operarios.

**Filtros:**
- Selector de año y mes (o "Año completo").

**Tarjetas de resumen (siempre visibles):**

| Tarjeta | Qué muestra |
|---------|-------------|
| Incidencias | Total de registros y puntos acumulados del periodo |
| Registros CQ | Total de registros y coste total (€) |
| Visitas OK | Porcentaje y ratio OK/total |
| ISSUS Abiertas | Cantidad y cuántas están cerradas |

**Widgets por operario (activables/desactivables):**

- **Incidencias por operario** — Barras proporcionales al número de registros y puntos.
- **Control de Calidad** — Barras por coste total de cada operario.
- **Visitas** — Tabla con columnas OK, KO y % OK por operario.
- **Horas Improductivas** — Barras de horas y consumibles por operario.
- **ISSUS por tipo** — Distribución porcentual de los tipos de ISSUS.
- **Limpieza** — Recuento de registros por operario.

**Gestionar dashboard:**
Pulsa el botón "Gestionar dashboard" para:
- Activar o desactivar cada widget con checkboxes.
- Ver y eliminar KPIs personalizados.
- Crear un nuevo KPI personalizado:
  1. Introduce un nombre.
  2. Selecciona la tabla de datos (Incidencias, CQ, Visitas, etc.).
  3. Selecciona la métrica (recuento o suma de un campo numérico).
  4. Elige un color.
  5. Pulsa "Añadir KPI" → aparece como tarjeta en el dashboard.

Las preferencias del dashboard se guardan en el navegador (localStorage).

---

### KPI Mensual (vista global)

Vista comparativa del KPI Mensual de todos los operarios activos.

> Los datos provienen del localStorage del mismo navegador donde se introducen.

**Modos de visualización:**

#### Vista anual

- 4 tarjetas de resumen: Total equipo, A cobrar equipo, % Objetivo medio, Top operario.
- Tabla comparativa con una fila por operario:
  - Acumulados anuales de cada categoría (Productividad, Control Documental, Visitas, Retorno, Herramientas, Vehículo, Aseo).
  - Total anual · A cobrar · % Objetivo.
- Clic en una fila → **expande el desglose mensual completo** de ese operario con una subfila por mes.
- Fila final: **totales del equipo**.

#### Vista mensual

Selecciona un mes para ver los valores de entrada y calculados de ese mes para todos los operarios:
- % Productividad · Importe
- Control Documental pts · Importe
- Estado Visitas (OK/KO) · Importe
- % Retorno · Importe
- Estado Herramientas / Vehículo / Aseo (OK/KO)
- H. Objetivo · H. Invertidas · Penalización
- **Total mes · A cobrar**
- Fila final: totales del equipo en ese mes.

---

### Permisos y Roles

Matriz de configuración de permisos por rol.

**Columnas:** Jefe · Operario · Admin (siempre activado, no editable)

**Grupos de permisos:**

| Grupo | Permisos |
|-------|---------|
| Acceso a datos | Ver datos del equipo · Editar datos de operarios · Ver solo datos propios |
| KPI | Rellenar KPI mes activo · Histórico solo lectura · Editar mes cerrado · Validar KPI mensual |
| Visualización | Ver incentivos del equipo · Dashboard global de KPIs |
| Exportación | Exportar informes |
| Configuración | Modificar tablas de referencia · Gestionar usuarios · Abrir/cerrar periodos · Configurar incentivos |

Pulsa **Guardar cambios** para persistir la configuración.

> **Nota técnica:** Requiere que la columna `permisos_roles` exista en la tabla `config` de Supabase. Si aparece un aviso de migración, ejecuta en Supabase: `ALTER TABLE config ADD COLUMN IF NOT EXISTS permisos_roles JSONB;`

---

### Operarios

Gestión del catálogo de operarios (perfiles, no cuentas de acceso).

| Acción | Cómo |
|--------|------|
| Ver lista | Tabla con Nombre, Email y estado Activo/Inactivo |
| Añadir | Botón "Añadir" → formulario con Nombre, Email y checkbox Activo |
| Editar | Icono lápiz en la fila → mismo formulario con datos cargados |

> Los operarios marcados como **Inactivo** no aparecen en los desplegables de asignación de jefes ni en la creación de usuarios.

---

### Jefes

Gestión de los supervisores y sus asignaciones de operarios.

| Acción | Cómo |
|--------|------|
| Ver lista | Tabla con nombre del jefe |
| Añadir | Botón "Añadir" → formulario: Nombre + PIN (4 dígitos obligatorio) + asignación de operarios |
| Editar | Icono lápiz → mismo formulario; el PIN se puede dejar en blanco para no cambiarlo |

**Asignación de operarios:** En el formulario del jefe aparece una cuadrícula con todos los operarios activos. Marca los checkboxes de los operarios que dependen de ese jefe. Al guardar, la asignación se actualiza completamente.

---

### Usuarios Operario

Gestión de las cuentas de acceso de los operarios (login con PIN).

| Acción | Cómo |
|--------|------|
| Ver lista | Tabla con nombre del usuario operario |
| Añadir | Botón "Añadir" → desplegable con operarios activos + PIN (4 dígitos obligatorio) |
| Editar | Icono lápiz → campo de nombre libre + PIN opcional (dejar vacío para no cambiar) |

> El nombre del usuario operario debe coincidir con el nombre en la tabla de operarios para que el sistema muestre sus datos correctamente.

---

### Configuración

Ajustes globales de la aplicación.

| Campo | Descripción |
|-------|-------------|
| Nombre de la empresa | Se muestra en la cabecera de todas las páginas |
| URL del logo | URL pública de una imagen (PNG/JPG). Se muestra en la cabecera |
| Webhook URL (n8n) | Endpoint al que se envían los datos de los módulos 01–06 tras cada inserción |

Pulsa **Guardar** para aplicar los cambios.

---

## 9. Sincronización con n8n

Los módulos 01–06 envían cada nuevo registro a un webhook de n8n en tiempo real.

### Flujo de sincronización

1. El usuario guarda un registro en cualquier módulo.
2. La aplicación inserta el registro en Supabase.
3. Inmediatamente envía el mismo registro al webhook configurado en **Administración > Configuración**.
4. Si el envío falla (sin conexión, webhook caído), el registro se marca con `sync_pending = true`.
5. Al iniciar sesión, la app reintenta automáticamente enviar todos los registros pendientes.

### Indicador de estado

En **Mis Registros** se puede ver el estado de sincronización de cada registro:
- ✓ **Sincronizado** — El webhook recibió el registro correctamente.
- ⏳ **Pendiente** — El envío falló y se reintentará.

### Tablas que se sincronizan

| Módulo | Tabla n8n |
|--------|-----------|
| 01 Incidencias | `01_DB_INCIDENCIAS` |
| 02 Control Calidad | `02_CONTROL_CALIDAD` |
| 03 Visitas | `03_VISITAS` |
| 04 Limpieza | `04_LIMPIEZA` |
| 05 Horas Improductivas | `05_HORAS_IMPROD` |
| 06 ISSUS | `06_INCIDENCIAS_ISSUS` |

> **El módulo 07 KPI Mensual NO se sincroniza** con n8n. Sus datos se almacenan únicamente en el navegador.

---

## 10. Preguntas frecuentes

**¿Cómo recupero mi PIN?**
Contacta con el administrador. Desde Administración > Jefes o > Usuarios Operario puede editar tu usuario y establecer un nuevo PIN.

**¿Puedo editar un registro ya guardado?**
Actualmente no hay edición directa de registros en los módulos 01–06. Para corregir un dato, elimina el registro incorrecto y crea uno nuevo con los datos correctos.

**¿Por qué no veo los datos del KPI en otro dispositivo?**
Los datos del KPI Mensual (pestaña 07) se guardan en el navegador local (localStorage). Si cambias de dispositivo o navegador, los datos no estarán disponibles. Usa siempre el mismo dispositivo para introducir y consultar el KPI.

**¿Qué pasa si cierro el navegador sin guardar el KPI?**
El KPI Mensual guarda automáticamente cada cambio al instante. No es necesario pulsar ningún botón de guardar.

**No aparecen datos en el Dashboard del administrador para un operario.**
Comprueba que el operario tiene registros en Supabase para el periodo seleccionado. Los datos del Dashboard provienen de Supabase (módulos 01–06), no de localStorage.

**El jefe no puede editar los datos de un operario.**
Comprueba en Administración > Jefes que el operario está asignado a ese jefe. Si el operario aparece en la lista pero con "Vista de solo lectura", significa que no está en las asignaciones del jefe.

**Los datos no se sincronizan con n8n.**
Verifica que la URL del webhook está correctamente configurada en Administración > Configuración. En Mis Registros puedes ver qué registros tienen sincronización pendiente.

**¿Cómo desactivo un operario que ya no trabaja?**
En Administración > Operarios, edita el operario y desmarca el checkbox "Activo". El operario dejará de aparecer en los desplegables de asignación pero sus datos históricos se conservan.

---

*Manual generado para ACM Tools. Para soporte técnico, contacta con el administrador del sistema.*
