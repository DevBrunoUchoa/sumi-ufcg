import React, { useEffect, useState } from 'react';
import { Button, Field, FormEnd, Icon, Input, Modal, Select, Textarea } from './ui.jsx';
import { controlFactor, createPlan, deliveryStatusLabels, historyEntry, normalize, periods, residualRisk, riskLevel, riskLevelFromScore, riskLevelLabel, riskScore, uid } from './domain.js';
import { listarUsuarios } from './admin-client.js';
import { defineCustomElement as defineBrDatetimePicker } from '@govbr-ds/webcomponents/dist/components/br-datetime-picker.js';
defineBrDatetimePicker();


export function PlanForm({ templates, initialTemplate = 'pdi', onClose, onSave }) {
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [error, setError] = useState('');
  const template = templates.find((t) => t.id === templateId);
  function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try { onSave(createPlan(template, { name: fields.name, shortName: fields.shortName, start: Number(fields.start), end: Number(fields.end) })); }
    catch (e) { setError(e.message); }
  }
  return <Modal title="Novo planejamento" subtitle="Comece com um modelo e preencha o seu plano." onClose={onClose}>
    <form onSubmit={submit}>
      <div className="form-body">
        <Field label="Modelo"><Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} options={[{ value: '', label: 'Selecione' }, ...templates.map((t) => ({ value: t.id, label: `${t.type} · ${t.name}` }))]} /></Field>
        <div className="structure-preview">{[template.labels.axis, template.labels.objective, template.labels.item, 'Ação', 'Etapa'].map((name, i) => <React.Fragment key={i}>{i > 0 && <Icon name="chevron" size={12} />}<span>{name}</span></React.Fragment>)}</div>
        <Field label="Nome do planejamento"><Input autoFocus name="name" required maxLength={120} placeholder="Ex.: Planejamento do Centro de Tecnologia" /></Field>
        <div className="form-grid three"><Field label="Sigla"><Input name="shortName" maxLength={12} required placeholder="Ex.: PCT" /></Field><Field label="Ano inicial"><Input name="start" type="number" min="2020" max="2100" defaultValue="2026" required /></Field><Field label="Ano final"><Input name="end" type="number" min="2020" max="2100" defaultValue="2030" required /></Field></div>
        <p className="hint">O planejamento será criado sem conteúdo. Os campos do modelo estarão disponíveis em cada {template.labels.item.toLowerCase()}.</p>
      </div><FormEnd onClose={onClose} submit="Criar planejamento" error={error} />
    </form>
  </Modal>;
}

export function TemplateForm({ template, onClose, onSave }) {
  const [fields, setFields] = useState(structuredClone(template.fields));
  const [error, setError] = useState('');
  const updateField = (id, key, value) => setFields(fields.map((f) => f.id === id ? { ...f, [key]: value } : f));
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const labels = { axis: values.axis.trim(), objective: values.objective.trim(), item: values.item.trim() };
    if (Object.values(labels).some((v) => !v)) return setError('Preencha os nomes dos níveis.');
    const prepared = fields.map((f) => ({ ...f, label: f.label.trim(), options: f.type === 'select' ? [...new Set(f.options.split(',').map((v) => v.trim()).filter(Boolean))].join(', ') : '' }));
    const names = prepared.map((f) => normalize(f.label));
    if (names.some((name) => !name) || new Set(names).size !== names.length) return setError('Use nomes preenchidos e diferentes para os campos adicionais.');
    if (prepared.some((f) => f.type === 'select' && f.options.split(',').filter((v) => v.trim()).length < 2)) return setError('Informe pelo menos duas opções diferentes para cada campo de seleção.');
    onSave({ ...template, labels, fields: prepared, version: template.version + 1 });
  }
  return <Modal title={`Personalizar modelo ${template.type}`} subtitle="As alterações valem para novos planejamentos." onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-body">
      <h3>Nomes apresentados na navegação</h3><div className="form-grid three">
        <Field label="Primeiro nível"><Input name="axis" required defaultValue={template.labels.axis} maxLength={32} /></Field>
        <Field label="Segundo nível"><Input name="objective" required defaultValue={template.labels.objective} maxLength={32} /></Field>
        <Field label="Item acompanhado"><Input name="item" required defaultValue={template.labels.item} maxLength={32} /></Field>
      </div>
      <div className="section-heading"><h3>Campos adicionais</h3><Button class="br-button secondary" icon="plus" onClick={() => setFields([...fields, { id: uid(), label: '', type: 'text', options: '' }])}>Adicionar campo</Button></div>
      {!fields.length && <p className="hint">Os campos de identificação, responsáveis e indicadores já fazem parte do modelo.</p>}
      {fields.map((f, i) => <div className="custom-field" key={f.id}>
        <div className="form-grid"><Field label={`Nome do campo ${i + 1}`}><Input value={f.label} onChange={(e) => updateField(f.id, 'label', e.target.value)} maxLength={50} required /></Field><Field label={`Tipo do campo ${i + 1}`}><Select value={f.type} onChange={(e) => updateField(f.id, 'type', e.target.value)} options={[{ value: '', label: 'Selecione' }, { value: 'text', label: 'Texto' }, { value: 'number', label: 'Número' }, { value: 'date', label: 'Data' }, { value: 'select', label: 'Seleção' }]} /></Field></div>
        {f.type === 'select' && <Field label={`Opções do campo ${i + 1}`} help="Separe as opções por vírgulas."><Input value={f.options} onChange={(e) => updateField(f.id, 'options', e.target.value)} placeholder="Campina Grande, Cajazeiras, Patos" required /></Field>}
        <button type="button" class="br-button secondary" onClick={() => setFields(fields.filter((field) => field.id !== f.id))}>Remover campo {i + 1}</button>
      </div>)}
    </div><FormEnd onClose={onClose} submit="Salvar modelo" error={error} /></form>
  </Modal>;
}

function ExtraFields({ fields, item }) {
  return fields.map((f) => <Field key={f.id} label={f.label}>{f.type === 'select' ? <Select name={`extra-${f.id}`} defaultValue={item?.extras?.[f.id] || ''} options={[{ value: '', label: 'Selecione' }, ...f.options.split(',').map((o) => o.trim())]} /> : <Input name={`extra-${f.id}`} type={f.type} step={f.type === 'number' ? 'any' : undefined} maxLength={f.type === 'text' ? 200 : undefined} defaultValue={item?.extras?.[f.id] ?? ''} />}</Field>);
}

export function ItemForm({ plan, item, actor, onClose, onSave }) {
  const [error, setError] = useState('');
  const [measurementMode, setMeasurementMode] = useState(item?.metric.measurementMode || 'manual');
  const [valueType, setValueType] = useState(item?.metric.valueType || 'number');
  const [periodicity, setPeriodicity] = useState(item?.metric.periodicity || plan.template.defaultPeriodicity || 'annual');
  const [axisId, setAxisId] = useState(item?.axisId || plan.axes[0]?.id || '');
  const [objectiveId, setObjectiveId] = useState(item?.objectiveId || plan.objectives.find((objective) => objective.axisId === (item?.axisId || plan.axes[0]?.id))?.id || '');
  const label = plan.template.labels;
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (['title', 'owner', 'axisId', 'objectiveId', 'code'].some((key) => !String(values[key] || '').trim())) return setError('Preencha os campos obrigatórios com conteúdo.');
    if (plan.items.some((i) => i.id !== item?.id && normalize(i.code) === normalize(values.code.trim()))) return setError('Este código já existe neste planejamento.');
    const extras = Object.fromEntries(plan.template.fields.map((f) => [f.id, values[`extra-${f.id}`] || '']));
    const details = { title: values.title.trim(), owner: values.owner.trim(), axisId: values.axisId, objectiveId: values.objectiveId, code: values.code.trim(), description: values.description.trim(), partners: values.partners.trim(), extras };
    if (!values.metric?.trim()) return setError('Informe o nome do indicador.');
    if (item) {
      const metric = {
        ...item.metric,
        name: values.metric.trim(),
        reference: values.reference.trim(),
        formula: values.formula.trim(),
        ...(item.metric.measurementMode === 'manual' ? {
          unit: values.unit.trim(),
          baseline: values.baseline === '' ? null : Number(values.baseline),
          direction: values.direction,
        } : {}),
      };
      if (item.metric.measurementMode === 'manual' && !metric.unit) return setError('Informe a unidade do indicador.');
      return onSave({ ...item, ...details, metric, history: [...item.history, historyEntry('Informações do item atualizadas.', actor)] });
    }
    if (measurementMode === 'manual' && !values.unit?.trim()) return setError('Informe a unidade do indicador.');
    const periodKeys = periodicity === 'final' ? [plan.end] : Array.from({ length: plan.end - plan.start + 1 }, (_, index) => plan.start + index);
    const metricTargets = Object.fromEntries(periodKeys.map((period) => [period, null]));
    const targetPeriod = Number(values.targetPeriod);
    metricTargets[targetPeriod] = measurementMode === 'delivery' ? values.target : values.target === '' ? null : Number(values.target);
    const metric = {
      name: values.metric.trim(), measurementMode, valueType: measurementMode === 'delivery' ? 'status' : measurementMode === 'stages' ? 'percentage' : valueType,
      unit: measurementMode === 'delivery' ? '' : measurementMode === 'stages' ? '%' : values.unit.trim(), periodicity,
      baseline: measurementMode === 'manual' && values.baseline !== '' ? Number(values.baseline) : measurementMode === 'delivery' ? 'not_started' : 0,
      reference: 'Referência institucional', direction: values.direction || 'up', targets: metricTargets,
      completedValue: measurementMode === 'delivery' ? 'completed' : undefined,
      formula: measurementMode === 'stages' ? 'Etapas concluídas ÷ total de etapas × 100' : measurementMode === 'delivery' ? 'Situação da entrega validada pela área responsável' : 'Resultado informado no período',
    };
    onSave({ ...details, id: uid(), reviewStatus: 'draft', reviewNote: '', metric, actions: [], measurements: [], history: [historyEntry('Item criado no planejamento.', actor)], risks: [], source: 'Cadastro institucional' });
  }
  const objectives = plan.objectives.filter((objective) => objective.axisId === axisId);
  const changeAxis = (nextAxisId) => {
    setAxisId(nextAxisId);
    setObjectiveId(plan.objectives.find((objective) => objective.axisId === nextAxisId)?.id || '');
  };
  const targetPeriods = periodicity === 'final' ? [plan.end] : Array.from({ length: plan.end - plan.start + 1 }, (_, index) => plan.start + index);
  return <Modal title={item ? 'Editar informações' : `Adicionar ${label.item.toLowerCase()}`} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-body">
      <div className="form-grid"><Field label={label.axis}><Select name="axisId" required value={axisId} onChange={(event) => changeAxis(event.target.value)} options={[{ value: '', label: 'Selecione' }, ...plan.axes.map((axis) => ({ value: axis.id, label: `${axis.code} · ${axis.name}` }))]} /></Field><Field label={label.objective}><Select name="objectiveId" required value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)} options={[{ value: '', label: 'Selecione' }, ...objectives.map((objective) => ({ value: objective.id, label: `${objective.code} · ${objective.title}` }))]} /></Field></div>
      <div className="form-grid code-title"><Field label="Código"><Input name="code" required maxLength={24} defaultValue={item?.code || ''} placeholder="Ex.: 1.1.1" /></Field><Field label="Título"><Input name="title" required maxLength={180} defaultValue={item?.title || ''} /></Field></div>
      <Field label="Descrição"><Textarea name="description" rows="2" maxLength={2000} defaultValue={item?.description || ''} /></Field>
      <div className="form-grid"><Field label="Unidade responsável"><Input name="owner" required maxLength={80} defaultValue={item?.owner || ''} placeholder="Ex.: SEPLAN" /></Field><Field label="Parceiros"><Input name="partners" maxLength={150} defaultValue={item?.partners || ''} /></Field></div>
      <ExtraFields fields={plan.template.fields} item={item} />
      {item && <><div className="section-divider" /><h3>Configuração do indicador</h3><div className="structure-preview"><span>{item.metric.measurementMode === 'manual' ? 'Valor informado' : item.metric.measurementMode === 'delivery' ? 'Entrega acompanhada' : 'Calculado pelas etapas'}</span><Icon name="chevron" size={12} /><span>{item.metric.periodicity === 'annual' ? 'Metas anuais' : 'Meta do ciclo'}</span></div><Field label="Nome do indicador"><Input name="metric" required maxLength={160} defaultValue={item.metric.name} /></Field>{item.metric.measurementMode === 'manual' && <div className="form-grid three"><Field label="Unidade"><Input name="unit" required maxLength={24} defaultValue={item.metric.unit} /></Field><Field label="Melhor resultado"><Select name="direction" defaultValue={item.metric.direction} options={[{ value: '', label: 'Selecione' }, { value: 'up', label: 'Quanto maior, melhor' }, { value: 'down', label: 'Quanto menor, melhor' }]} /></Field><Field label="Linha de base"><Input name="baseline" type="number" step="any" defaultValue={item.metric.baseline ?? ''} /></Field></div>}<Field label="Referência"><Input name="reference" maxLength={240} defaultValue={item.metric.reference || ''} /></Field><Field label="Fórmula ou critério"><Textarea name="formula" rows="2" maxLength={500} defaultValue={item.metric.formula || ''} /></Field></>}
      {!item && <><div className="section-divider" /><h3>Forma de acompanhamento</h3><Field label="Como este indicador será acompanhado?"><Select name="measurementMode" value={measurementMode} onChange={(event) => setMeasurementMode(event.target.value)} options={[{ value: '', label: 'Selecione' }, { value: 'manual', label: 'Informando um valor' }, { value: 'delivery', label: 'Acompanhando uma entrega' }, { value: 'stages', label: 'Calculando pelas etapas' }]} /></Field><Field label="Nome do indicador"><Input name="metric" required maxLength={160} placeholder="Ex.: Número de relatórios entregues" /></Field>
        <Field label="Periodicidade"><Select name="periodicity" value={periodicity} onChange={(event) => setPeriodicity(event.target.value)} options={[{ value: '', label: 'Selecione' }, { value: 'annual', label: 'Metas anuais' }, { value: 'final', label: 'Meta para todo o ciclo' }]} /></Field>
        {measurementMode === 'manual' && <div className="form-grid three"><Field label="Formato do valor"><Select value={valueType} onChange={(event) => setValueType(event.target.value)} options={[{ value: '', label: 'Selecione' }, { value: 'number', label: 'Número' }, { value: 'percentage', label: 'Percentual' }]} /></Field><Field label="Unidade"><Input name="unit" required maxLength={24} placeholder={valueType === 'percentage' ? '%' : 'relatórios, m³…'} defaultValue={valueType === 'percentage' ? '%' : ''} /></Field><Field label="Melhor resultado"><Select name="direction" options={[{ value: '', label: 'Selecione' }, { value: 'up', label: 'Quanto maior, melhor' }, { value: 'down', label: 'Quanto menor, melhor' }]} /></Field><Field label="Linha de base"><Input name="baseline" type="number" step="any" /></Field></div>}
        <div className="form-grid"><Field label={periodicity === 'final' ? 'Período da meta' : 'Ano da meta'}><Select name="targetPeriod" defaultValue={targetPeriods[0]} options={[{ value: '', label: 'Selecione' }, ...targetPeriods.map((period) => ({ value: period, label: periodicity === 'final' ? `${plan.start}–${plan.end}` : period }))]} /></Field>{measurementMode === 'delivery' ? <Field label="Situação esperada"><Select name="target" defaultValue="completed" options={[{ value: '', label: 'Selecione' }, ...Object.entries(deliveryStatusLabels).map(([value, text]) => ({ value, label: text }))]} /></Field> : <Field label={measurementMode === 'stages' ? 'Meta de conclusão (%)' : 'Valor esperado'}><Input name="target" type="number" step="any" min="0" max={measurementMode === 'stages' || valueType === 'percentage' ? 100 : undefined} /></Field>}</div></>}
    </div><FormEnd onClose={onClose} submit={item ? 'Salvar alterações' : 'Adicionar ao plano'} error={error} /></form>
  </Modal>;
}

export function StructureForm({ plan, onClose, onSave }) {
  const [axes, setAxes] = useState(structuredClone(plan.axes));
  const [objectives, setObjectives] = useState(structuredClone(plan.objectives));
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => { listarUsuarios().then(setUsuarios).catch(() => setUsuarios([])); }, []);
  const updateAxis = (id, field, value) => setAxes((current) => current.map((axis) => axis.id === id ? { ...axis, [field]: value } : axis));
  const toggleAxisUser = (id, field, userId) => setAxes((current) => current.map((axis) => axis.id !== id ? axis : { ...axis, [field]: (axis[field] || []).includes(userId) ? axis[field].filter((candidate) => candidate !== userId) : [...(axis[field] || []), userId] }));
  const updateObjective = (id, field, value) => setObjectives((current) => current.map((objective) => objective.id === id ? { ...objective, [field]: value } : objective));
  function submit(event) {
    event.preventDefault();
    if (axes.some((axis) => !axis.code.trim() || !axis.name.trim() || !axis.ownerUnit.trim())) return setError('Preencha código, nome e unidade responsável de todos os eixos.');
    if (objectives.some((objective) => !objective.code.trim() || !objective.title.trim() || !axes.some((axis) => axis.id === objective.axisId))) return setError('Preencha código, título e eixo de todos os objetivos.');
    if (new Set(axes.map((axis) => normalize(axis.code))).size !== axes.length) return setError('Os códigos dos eixos não podem se repetir.');
    if (new Set(objectives.map((objective) => `${objective.axisId}:${normalize(objective.code)}`)).size !== objectives.length) return setError('Os códigos dos objetivos não podem se repetir no mesmo eixo.');
    onSave({ axes, objectives });
  }
  const removeAxis = (id) => {
    if (plan.items.some((item) => item.axisId === id)) return setError('Não é possível remover um eixo que possui itens cadastrados.');
    setAxes((current) => current.filter((axis) => axis.id !== id));
    setObjectives((current) => current.filter((objective) => objective.axisId !== id));
  };
  const removeObjective = (id) => {
    if (plan.items.some((item) => item.objectiveId === id)) return setError('Não é possível remover um objetivo que possui itens cadastrados.');
    setObjectives((current) => current.filter((objective) => objective.id !== id));
  };
  return <Modal title="Estrutura do planejamento" subtitle={plan.name} onClose={onClose} wide><form onSubmit={submit}><div className="form-body"><div className="section-heading"><div><h3>Eixos</h3><p className="hint">Defina a estrutura institucional e a unidade responsável.</p></div><Button icon="plus" onClick={() => setAxes((current) => [...current, { id: uid(), code: '', name: '', color: '#2f78a5', ownerUnit: '', managerIds: [], reviewerIds: [] }])}>Adicionar eixo</Button></div><div className="structure-list">{axes.map((axis) => <div className="structure-row axis-structure" key={axis.id}><Input aria-label="Código do eixo" value={axis.code} onChange={(event) => updateAxis(axis.id, 'code', event.target.value)} placeholder="1" /><Input aria-label="Nome do eixo" value={axis.name} onChange={(event) => updateAxis(axis.id, 'name', event.target.value)} placeholder="Nome do eixo" /><Input aria-label="Unidade responsável pelo eixo" value={axis.ownerUnit} onChange={(event) => updateAxis(axis.id, 'ownerUnit', event.target.value)} placeholder="Unidade responsável" /><Input aria-label={`Cor do eixo ${axis.code || 'novo'}`} type="color" value={axis.color} onChange={(event) => updateAxis(axis.id, 'color', event.target.value)} /><button type="button" className="text-button danger" onClick={() => removeAxis(axis.id)}>Remover</button>
    <AxisUserPicker label="Gestor do eixo" help="Pode cadastrar/atualizar etapas, registrar resultados e enviar para validação." usuarios={usuarios} selectedIds={axis.managerIds || []} onToggle={(userId) => toggleAxisUser(axis.id, 'managerIds', userId)} />
    <AxisUserPicker label="Responsável pelo eixo" help="Valida ou solicita correção nos itens enviados deste eixo." usuarios={usuarios} selectedIds={axis.reviewerIds || []} onToggle={(userId) => toggleAxisUser(axis.id, 'reviewerIds', userId)} />
  </div>)}</div><div className="section-divider" /><div className="section-heading"><div><h3>Objetivos</h3><p className="hint">Cada objetivo pertence a um eixo.</p></div><Button icon="plus" disabled={!axes.length} onClick={() => setObjectives((current) => [...current, { id: uid(), axisId: axes[0]?.id || '', code: '', title: '' }])}>Adicionar objetivo</Button></div><div className="structure-list">{objectives.map((objective) => <div className="structure-row objective-structure" key={objective.id}><Select aria-label="Eixo do objetivo" value={objective.axisId} onChange={(event) => updateObjective(objective.id, 'axisId', event.target.value)} options={[{ value: '', label: 'Selecione' }, ...axes.map((axis) => ({ value: axis.id, label: `${axis.code} · ${axis.name}` }))]} /><Input aria-label="Código do objetivo" value={objective.code} onChange={(event) => updateObjective(objective.id, 'code', event.target.value)} placeholder="1.1" /><Input aria-label="Nome do objetivo" value={objective.title} onChange={(event) => updateObjective(objective.id, 'title', event.target.value)} placeholder="Descrição do objetivo" /><button type="button" className="text-button danger" onClick={() => removeObjective(objective.id)}>Remover</button></div>)}</div></div><FormEnd onClose={onClose} submit="Salvar estrutura" error={error} /></form></Modal>;
}

function AxisUserPicker({ label, help, usuarios, selectedIds, onToggle }) {
  return <details className="axis-user-picker">
    <summary>{label} {selectedIds.length > 0 && <span className="picker-count">({selectedIds.length})</span>}</summary>
    <p className="hint">{help}</p>
    {!usuarios.length ? <p className="hint">Nenhum usuário disponível.</p> : <ul>{usuarios.map((usuario) => <li key={usuario.id}><label><input type="checkbox" checked={selectedIds.includes(usuario.id)} onChange={() => onToggle(usuario.id)} /> {usuario.nome} <small>{usuario.email}</small></label></li>)}</ul>}
  </details>;
}

export function ActionForm({ plan, item, onClose, onSave }) {
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.title.trim() || !values.owner.trim()) return setError('Informe a ação e a unidade responsável.');
    if (!/^\d+$/.test(values.codeSuffix.trim())) return setError('Informe o último número do código da ação.');
    const code = `${item.code}.${values.codeSuffix.trim()}`;
    if (item.actions.some((action) => normalize(action.code) === normalize(code))) return setError('Este código já existe nesta iniciativa.');
    onSave({ id: uid(), code, title: values.title.trim(), owner: values.owner.trim(), deadline: values.deadline, tasks: [] });
  }
  return <Modal title="Adicionar ação" subtitle={`${plan.template.labels.item} ${item.code}`} onClose={onClose}><form onSubmit={submit}><div className="form-body"><Field label="Código da ação" help={`O código da ${plan.template.labels.item.toLowerCase()} já está preenchido; informe apenas o último número.`}><div className="code-input"><span>{item.code}.</span><Input name="codeSuffix" required inputMode="numeric" pattern="[0-9]+" maxLength={6} aria-label="Último número do código" /></div></Field><Field label="Nome da ação"><Input name="title" required maxLength={180} autoFocus /></Field><Field label="Unidade responsável"><Input name="owner" required defaultValue={item.owner} maxLength={80} /></Field><Field label="Prazo"><Input name="deadline" type="date" min={`${plan.start}-01-01`} max={`${plan.end}-12-31`} required /></Field></div><FormEnd onClose={onClose} submit="Adicionar ação" error={error} /></form></Modal>;
}

export function RiskForm({ item, action, risk, onClose, onSave }) {
  const [probability, setProbability] = useState(risk?.probability || 3);
  const [impact, setImpact] = useState(risk?.impact || 3);
  const [maturity, setMaturity] = useState(risk?.maturity || 'Fraco');
  const [error, setError] = useState('');
  const level = riskLevel(probability, impact);
  const score = riskScore(probability, impact);
  const residual = residualRisk(probability, impact, maturity);
  const field = (name) => risk?.[name] || '';
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const required = ['title', 'cause', 'consequence', 'controls', 'treatment', 'treatmentOwner'];
    if (required.some((name) => !values[name].trim())) return setError('Preencha os campos principais do risco.');
    onSave({ ...(risk || {}), id: risk?.id || uid(), actionId: action.id, stage: values.stage.trim(), title: values.title.trim(), strategicRisk: values.strategicRisk.trim(), cause: values.cause.trim(), consequence: values.consequence.trim(), category: values.category, probability, impact, controls: values.controls.trim(), controlType: values.controlType, maturity, response: values.response, treatment: values.treatment.trim(), treatmentOwner: values.treatmentOwner.trim(), deadline: values.deadline, execution: Number(values.execution || 0), situation: values.situation, review: values.review, status: values.status });
  }
  return <Modal title={risk ? 'Editar risco' : 'Adicionar risco'} subtitle={`${item.code} · ${action.title}`} onClose={onClose} wide><form onSubmit={submit}><div className="form-body">
    <div className="risk-form-context"><span><b>Ação:</b> {action.title}</span><span><b>Etapa:</b> {risk?.stage || 'Será definida no formulário'}</span></div>
    <h3>Identificação do risco</h3><Field label="Etapa" help="Associe o risco à etapa específica em que ele foi identificado."><Select name="stage" defaultValue={field('stage') || action.tasks[0]?.title || ''} options={[{ value: '', label: 'Ação sem etapa específica' }, ...action.tasks.map((task) => task.title)]} /></Field>
    <Field label="Risco do processo"><Textarea name="title" rows="2" required maxLength={240} defaultValue={field('title')} placeholder="Ex.: Dados institucionais incompletos para a inscrição" /></Field>
    <Field label="Risco estratégico da iniciativa"><Textarea name="strategicRisk" rows="2" maxLength={240} defaultValue={field('strategicRisk')} placeholder="Ex.: Não cumprir a meta institucional no prazo" /></Field>
    <div className="form-grid"><Field label="Causa do risco"><Textarea name="cause" rows="2" required maxLength={300} defaultValue={field('cause')} /></Field><Field label="Efeito / consequência"><Textarea name="consequence" rows="2" required maxLength={300} defaultValue={field('consequence')} /></Field></div>
    <Field label="Categoria do risco"><Select name="category" defaultValue={field('category') || 'Operacional'} options={[{ value: '', label: 'Selecione' }, 'Operacional', 'Imagem/Reputação', 'Político-legal', 'Financeiro/Orçamentário', 'Ambiental', 'Estratégico', 'Conformidade']} /></Field>
    <h3>Avaliação e controles</h3><div className="form-grid three"><Field label="Probabilidade (P)"><Select value={probability} onChange={(event) => setProbability(Number(event.target.value))} options={[{ value: '', label: 'Selecione' }, 1, 2, 3, 4, 5]} /></Field><Field label="Impacto (I)"><Select value={impact} onChange={(event) => setImpact(Number(event.target.value))} options={[{ value: '', label: 'Selecione' }, 1, 2, 3, 4, 5]} /></Field><Field label="Tipo de controle"><Select name="controlType" defaultValue={field('controlType') || 'Preventivo'} options={[{ value: '', label: 'Selecione' }, 'Preventivo', 'Detectivo', 'Corretivo']} /></Field></div>
    <Field label="Controles existentes"><Textarea name="controls" rows="2" required maxLength={300} defaultValue={field('controls')} placeholder="Descreva os controles já existentes" /></Field><Field label="Maturidade do controle"><Select value={maturity} onChange={(event) => setMaturity(event.target.value)} options={[{ value: '', label: 'Selecione' }, ...[['Inexistente', '1,0'], ['Fraco', '0,8'], ['Mediano', '0,6'], ['Satisfatório', '0,4'], ['Forte', '0,2']].map(([name, factor]) => ({ value: name, label: `${name} · FC ${factor}` }))]} /></Field>
    <div className="risk-calculation"><div className={`risk-calculation-value ${level}`}><span>Risco inerente (RI)</span><strong>{score}</strong><b>{riskLevelLabel(level)}</b><small>P × I = {probability} × {impact}</small></div><div className={`risk-calculation-value ${riskLevelFromScore(residual)}`}><span>Risco residual (RR)</span><strong>{residual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</strong><b>{riskLevelLabel(riskLevelFromScore(residual))}</b><small>RI × FC = {score} × {controlFactor(maturity)}</small></div></div>
    <h3>Resposta e acompanhamento</h3>
      <div className="form-grid">
        <Field label="Resposta ao risco"><Select name="response" defaultValue={field('response') || 'Mitigar'} options={[{ value: '', label: 'Selecione' }, 'Aceitar', 'Mitigar', 'Compartilhar', 'Evitar']} /></Field>
        <Field label="Responsável pelo tratamento"><Input name="treatmentOwner" required maxLength={100} defaultValue={field('treatmentOwner') || item.owner} /></Field>
      </div>
      <Field label="Plano de tratamento"><Textarea name="treatment" rows="2" required maxLength={400} defaultValue={field('treatment')} placeholder="Controles propostos para reduzir o risco" /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', marginBottom: '1rem' }}>
      <Field label="Prazo de conclusão">
        <br-datetime-picker
          mode="date"
          locale="pt-BR"
          required
          placeholder="Selecione o prazo"
          aria-label="Prazo de conclusão"
          serializedValue={field('deadline')}
          style={{ display: 'block', marginTop: '-12px' }} 
        />
      </Field>
      <Field label="Execução (%)">
        <Input name="execution" type="number" min="0" max="100" defaultValue={risk?.execution ?? 0} />
      </Field>
    </div>
    <div className="form-grid three">
      <Field label="Frequência de revisão"><Select name="review" defaultValue={field('review') || 'Trimestral'} options={[{ value: '', label: 'Selecione' }, 'Mensal', 'Trimestral', 'Semestral', 'Anual']} /></Field>
      <Field label="Situação"><Select name="situation" defaultValue={field('situation') || 'Não iniciada'} options={[{ value: '', label: 'Selecione' }, 'Não iniciada', 'Em andamento', 'Concluída']} /></Field>
      <Field label="Status do risco"><Select name="status" defaultValue={field('status') || 'Ativo'} options={[{ value: '', label: 'Selecione' }, 'Ativo', 'Mitigado', 'Encerrado', 'Reclassificado']} /></Field>
    </div>
  </div><FormEnd onClose={onClose} submit={risk ? 'Salvar alterações' : 'Adicionar risco'} error={error} /></form></Modal>;
}

export function MeasurementForm({ plan, item, year, onClose, onSave }) {
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.note.trim()) return setError('Descreva o resultado registrado.');
    if (values.evidence) {
      try { if (!['https:', 'http:'].includes(new URL(values.evidence).protocol)) throw new Error(); }
      catch { return setError('Use um endereço de evidência iniciado por https:// ou http://.'); }
    }
    onSave({ id: uid(), year: Number(values.year), value: item.metric.valueType === 'status' ? values.value : Number(values.value), note: values.note.trim(), evidence: values.evidence.trim(), at: new Date().toISOString() });
  }
  return <Modal title="Registrar resultado" subtitle={item.metric.name} onClose={onClose}><form onSubmit={submit}><div className="form-body">
    <div className="form-grid"><Field label={item.metric.periodicity === 'final' ? 'Período do resultado' : 'Ano do resultado'}><Select name="year" defaultValue={year} options={[{ value: '', label: 'Selecione' }, ...periods(plan, item).map((period) => ({ value: period, label: item.metric.periodicity === 'final' ? `${plan.start}–${plan.end}` : period }))]} /></Field>{item.metric.valueType === 'status' ? <Field label="Situação da entrega"><Select autoFocus name="value" defaultValue="in_progress" required options={[{ value: '', label: 'Selecione' }, ...Object.entries(deliveryStatusLabels).map(([value, text]) => ({ value, label: text }))]} /></Field> : <Field label={`Valor${item.metric.unit ? ` (${item.metric.unit})` : ''}`}><Input autoFocus name="value" type="number" min="0" max={item.metric.valueType === 'percentage' ? 100 : undefined} step="any" required /></Field>}</div>
    <Field label="Justificativa / observação"><Textarea name="note" rows="3" required maxLength={2000} placeholder="Descreva o resultado e o contexto da medição." /></Field>
    <Field label="Link da evidência (opcional)"><Input name="evidence" type="url" maxLength={2000} placeholder="https://…" /></Field>
    <p className="hint">Um novo registro atualiza o resultado do período e preserva os registros anteriores.</p>
  </div><FormEnd onClose={onClose} submit="Salvar resultado" error={error} /></form></Modal>;
}

export function TargetsForm({ plan, item, onClose, onSave }) {
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    onSave(Object.fromEntries(periods(plan, item).map((period) => [period, values[period] === '' ? null : item.metric.valueType === 'status' ? values[period] : Number(values[period])] )));
  }
  return <Modal title={item.metric.periodicity === 'final' ? 'Editar meta do ciclo' : 'Editar metas anuais'} subtitle={`${item.metric.name}${item.metric.unit ? ` · ${item.metric.unit}` : ''}`} onClose={onClose}><form onSubmit={submit}><div className="form-body">
    <p className="hint">Campo vazio significa sem meta definida; zero é preservado como um valor válido.</p>
    <div className="form-grid three">{periods(plan, item).map((period) => <Field key={period} label={item.metric.periodicity === 'final' ? `Ciclo ${plan.start}–${plan.end}` : `Meta de ${period}`}>{item.metric.valueType === 'status' ? <Select name={period} defaultValue={item.metric.targets[period] ?? ''} options={[{ value: '', label: 'Sem meta definida' }, ...Object.entries(deliveryStatusLabels).map(([value, text]) => ({ value, label: text }))]} /> : <Input name={period} type="number" min="0" max={item.metric.valueType === 'percentage' ? 100 : undefined} step="any" defaultValue={item.metric.targets[period] ?? ''} />}</Field>)}</div>
  </div><FormEnd onClose={onClose} submit="Salvar metas" /></form></Modal>;
}

export function ReviewForm({ item, decision, onClose, onSave }) {
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (decision === 'changes_requested' && !values.note.trim()) return setError('Informe o que precisa ser corrigido.');
    onSave({ status: decision, note: values.note.trim() });
  }
  const returning = decision === 'changes_requested';
  return <Modal title={returning ? 'Solicitar correção' : 'Validar informações'} subtitle={item.title} onClose={onClose}><form onSubmit={submit}><div className="form-body">
    <Field label={returning ? 'Correções necessárias' : 'Observação da validação'}><Textarea name="note" rows="4" required={returning} maxLength={400} placeholder={returning ? 'Descreva objetivamente o que precisa ser ajustado.' : 'Registre uma observação, se necessário.'} /></Field>
  </div><FormEnd onClose={onClose} submit={returning ? 'Devolver para correção' : 'Confirmar validação'} error={error} /></form></Modal>;
}
