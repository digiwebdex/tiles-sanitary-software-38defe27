import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, Plus, Trash2, Edit3, UserPlus, BookOpen } from "lucide-react";
import { useDealerId } from "@/hooks/useDealerId";
import { employeeService, Employee } from "@/services/employeeService";
import {
  trainingService, Skill, TrainingProgram, TrainingEnrollment, SkillMatrix, proficiencyLabel,
} from "@/services/trainingService";

function profBadgeColor(p: number): string {
  if (p >= 5) return "bg-emerald-600";
  if (p >= 4) return "bg-green-600";
  if (p >= 3) return "bg-amber-600";
  if (p >= 2) return "bg-orange-600";
  if (p >= 1) return "bg-slate-600";
  return "bg-muted";
}

export default function TrainingPage() {
  const dealerId = useDealerId();
  const [employees, setEmployees] = useState<Employee[]>([]);

  /* -------- Skills tab -------- */
  const [skills, setSkills] = useState<Skill[]>([]);
  const [openSkill, setOpenSkill] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const emptySkill: Partial<Skill> = { code: "", name: "", category: "technical", description: "", is_active: true };
  const [skillForm, setSkillForm] = useState<Partial<Skill>>(emptySkill);

  /* -------- Matrix tab -------- */
  const [matrix, setMatrix] = useState<SkillMatrix | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ employee_id: string; skill_id: string; proficiency: number; notes: string }>({
    employee_id: "", skill_id: "", proficiency: 3, notes: "",
  });

  /* -------- Programs tab -------- */
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [openProgram, setOpenProgram] = useState(false);
  const [editProgram, setEditProgram] = useState<TrainingProgram | null>(null);
  const emptyProgram: Partial<TrainingProgram> = {
    title: "", description: "", trainer: "", mode: "in_person",
    duration_hours: 0, cost: 0, start_date: "", end_date: "", status: "planned",
  };
  const [programForm, setProgramForm] = useState<Partial<TrainingProgram>>(emptyProgram);
  const [detail, setDetail] = useState<TrainingProgram | null>(null);
  const [enrollIds, setEnrollIds] = useState<Record<string, boolean>>({});

  /* -------- Load -------- */
  const reloadAll = async () => {
    if (!dealerId) return;
    try {
      const [emps, sk, pr, mx] = await Promise.all([
        employeeService.list(dealerId),
        trainingService.listSkills(),
        trainingService.listPrograms(),
        trainingService.matrix(),
      ]);
      setEmployees(emps);
      setSkills(sk);
      setPrograms(pr);
      setMatrix(mx);
    } catch (e: any) {
      toast({ title: "Failed to load training data", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => { reloadAll(); /* eslint-disable-next-line */ }, [dealerId]);

  /* ==================== Skill handlers ==================== */
  const saveSkill = async () => {
    try {
      if (editSkill) {
        await trainingService.updateSkill(editSkill.id, skillForm);
        toast({ title: "Skill updated" });
      } else {
        await trainingService.createSkill(skillForm);
        toast({ title: "Skill created" });
      }
      setOpenSkill(false); setEditSkill(null); setSkillForm(emptySkill);
      reloadAll();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteSkill = async (id: string) => {
    if (!confirm("Delete this skill? Employee ratings will also be removed.")) return;
    try {
      await trainingService.removeSkill(id);
      toast({ title: "Skill deleted" });
      reloadAll();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  /* ==================== Matrix handlers ==================== */
  const saveAssign = async () => {
    if (!assignForm.employee_id || !assignForm.skill_id) {
      return toast({ title: "Pick employee & skill", variant: "destructive" });
    }
    try {
      await trainingService.upsertEmployeeSkill(assignForm);
      toast({ title: "Rating saved" });
      setAssignOpen(false);
      setAssignForm({ employee_id: "", skill_id: "", proficiency: 3, notes: "" });
      reloadAll();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const matrixStats = useMemo(() => {
    if (!matrix) return { avg: 0, gaps: 0, totalCells: 0 };
    let sum = 0, n = 0, gaps = 0;
    const totalCells = matrix.employees.length * matrix.skills.length;
    for (const e of matrix.employees) {
      for (const s of matrix.skills) {
        const v = matrix.matrix[e.id]?.[s.id] || 0;
        if (v) { sum += v; n++; } else gaps++;
      }
    }
    return { avg: n ? +(sum / n).toFixed(2) : 0, gaps, totalCells };
  }, [matrix]);

  /* ==================== Program handlers ==================== */
  const saveProgram = async () => {
    try {
      const payload = { ...programForm };
      // clean empty dates
      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (editProgram) {
        await trainingService.updateProgram(editProgram.id, payload);
        toast({ title: "Program updated" });
      } else {
        await trainingService.createProgram(payload);
        toast({ title: "Program created" });
      }
      setOpenProgram(false); setEditProgram(null); setProgramForm(emptyProgram);
      reloadAll();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm("Delete this program and all enrollments?")) return;
    try {
      await trainingService.removeProgram(id);
      toast({ title: "Program deleted" });
      reloadAll();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const openDetail = async (id: string) => {
    try {
      const p = await trainingService.getProgram(id);
      setDetail(p);
      setEnrollIds({});
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    }
  };

  const enrollSelected = async () => {
    if (!detail) return;
    const ids = Object.entries(enrollIds).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) return toast({ title: "Select employees first", variant: "destructive" });
    try {
      const res = await trainingService.enroll(detail.id, ids);
      toast({ title: `Enrolled ${res.inserted} (skipped ${res.skipped})` });
      openDetail(detail.id);
      reloadAll();
    } catch (e: any) {
      toast({ title: "Enroll failed", description: e.message, variant: "destructive" });
    }
  };

  const updateEnrollment = async (en: TrainingEnrollment, patch: Partial<TrainingEnrollment>) => {
    try {
      await trainingService.updateEnrollment(en.id, patch);
      if (detail) openDetail(detail.id);
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const removeEnrollment = async (en: TrainingEnrollment) => {
    if (!confirm(`Remove ${en.employee_name} from this program?`)) return;
    try {
      await trainingService.removeEnrollment(en.id);
      if (detail) openDetail(detail.id);
    } catch (e: any) {
      toast({ title: "Remove failed", description: e.message, variant: "destructive" });
    }
  };

  /* ============================ UI ============================ */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Training &amp; Skill Matrix
          </h1>
          <p className="text-muted-foreground text-sm">Catalog skills, rate proficiency, and run training programs.</p>
        </div>
      </div>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills">Skills Catalog</TabsTrigger>
          <TabsTrigger value="matrix">Skill Matrix</TabsTrigger>
          <TabsTrigger value="programs">Training Programs</TabsTrigger>
        </TabsList>

        {/* ============== Skills Catalog ============== */}
        <TabsContent value="skills">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Skills ({skills.length})</CardTitle>
              <Dialog open={openSkill} onOpenChange={(o) => { setOpenSkill(o); if (!o) { setEditSkill(null); setSkillForm(emptySkill); } }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Skill</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editSkill ? "Edit" : "Add"} Skill</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Code</Label><Input value={skillForm.code || ""} onChange={(e) => setSkillForm({ ...skillForm, code: e.target.value })} /></div>
                    <div><Label>Name</Label><Input value={skillForm.name || ""} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} /></div>
                    <div>
                      <Label>Category</Label>
                      <Select value={skillForm.category || "technical"} onValueChange={(v) => setSkillForm({ ...skillForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="product">Product Knowledge</SelectItem>
                          <SelectItem value="soft">Soft Skill</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Checkbox checked={skillForm.is_active !== false} onCheckedChange={(v) => setSkillForm({ ...skillForm, is_active: !!v })} />
                      <Label>Active</Label>
                    </div>
                    <div className="col-span-2"><Label>Description</Label><Textarea value={skillForm.description || ""} onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveSkill}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No skills yet.</TableCell></TableRow>}
                  {skills.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline">{s.category || "—"}</Badge></TableCell>
                      <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditSkill(s); setSkillForm(s); setOpenSkill(true); }}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteSkill(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== Skill Matrix ============== */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Skill Matrix</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg proficiency: <b>{matrixStats.avg}</b> · Coverage gaps: <b>{matrixStats.gaps}</b> / {matrixStats.totalCells}
                </p>
              </div>
              <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Rate Skill</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Rate Employee Skill</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Employee</Label>
                      <Select value={assignForm.employee_id} onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Skill</Label>
                      <Select value={assignForm.skill_id} onValueChange={(v) => setAssignForm({ ...assignForm, skill_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                        <SelectContent>
                          {skills.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Proficiency ({proficiencyLabel(assignForm.proficiency)})</Label>
                      <Select value={String(assignForm.proficiency)} onValueChange={(v) => setAssignForm({ ...assignForm, proficiency: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((p) => <SelectItem key={p} value={String(p)}>{p} — {proficiencyLabel(p)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Notes</Label><Textarea value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveAssign}>Save Rating</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!matrix || matrix.employees.length === 0 || matrix.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add active employees and skills to see the matrix.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Employee</TableHead>
                      {matrix.skills.map((s) => (
                        <TableHead key={s.id} className="text-center min-w-[110px]" title={s.category || ""}>{s.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrix.employees.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{e.name}</TableCell>
                        {matrix.skills.map((s) => {
                          const v = matrix.matrix[e.id]?.[s.id] || 0;
                          return (
                            <TableCell key={s.id} className="text-center">
                              {v ? (
                                <button
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded text-white text-sm font-semibold ${profBadgeColor(v)}`}
                                  title={`${proficiencyLabel(v)} — click to update`}
                                  onClick={() => { setAssignForm({ employee_id: e.id, skill_id: s.id, proficiency: v, notes: "" }); setAssignOpen(true); }}
                                >{v}</button>
                              ) : (
                                <button
                                  className="text-muted-foreground hover:text-foreground text-xs underline"
                                  onClick={() => { setAssignForm({ employee_id: e.id, skill_id: s.id, proficiency: 3, notes: "" }); setAssignOpen(true); }}
                                >rate</button>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== Programs ============== */}
        <TabsContent value="programs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Training Programs ({programs.length})</CardTitle>
              <Dialog open={openProgram} onOpenChange={(o) => { setOpenProgram(o); if (!o) { setEditProgram(null); setProgramForm(emptyProgram); } }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Program</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>{editProgram ? "Edit" : "Add"} Training Program</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Title</Label><Input value={programForm.title || ""} onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })} /></div>
                    <div><Label>Trainer</Label><Input value={programForm.trainer || ""} onChange={(e) => setProgramForm({ ...programForm, trainer: e.target.value })} /></div>
                    <div>
                      <Label>Mode</Label>
                      <Select value={programForm.mode || "in_person"} onValueChange={(v: any) => setProgramForm({ ...programForm, mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_person">In Person</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Duration (hours)</Label><Input type="number" value={programForm.duration_hours ?? 0} onChange={(e) => setProgramForm({ ...programForm, duration_hours: Number(e.target.value) })} /></div>
                    <div><Label>Cost (৳)</Label><Input type="number" value={programForm.cost ?? 0} onChange={(e) => setProgramForm({ ...programForm, cost: Number(e.target.value) })} /></div>
                    <div><Label>Start Date</Label><Input type="date" value={programForm.start_date || ""} onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })} /></div>
                    <div><Label>End Date</Label><Input type="date" value={programForm.end_date || ""} onChange={(e) => setProgramForm({ ...programForm, end_date: e.target.value })} /></div>
                    <div>
                      <Label>Status</Label>
                      <Select value={programForm.status || "planned"} onValueChange={(v: any) => setProgramForm({ ...programForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>Description</Label><Textarea value={programForm.description || ""} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveProgram}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead><TableHead>Trainer</TableHead><TableHead>Mode</TableHead>
                    <TableHead>Dates</TableHead><TableHead className="text-right">Enrolled</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No programs yet.</TableCell></TableRow>}
                  {programs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{p.trainer || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.mode}</Badge></TableCell>
                      <TableCell className="text-xs">{p.start_date || "?"} → {p.end_date || "?"}</TableCell>
                      <TableCell className="text-right">{p.enrolled_count || 0}</TableCell>
                      <TableCell><Badge variant={p.status === "completed" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openDetail(p.id)}><BookOpen className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditProgram(p); setProgramForm(p); setOpenProgram(true); }}><Edit3 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteProgram(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Program detail / enrollments */}
          <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{detail?.title}</DialogTitle>
                <p className="text-xs text-muted-foreground">{detail?.trainer} · {detail?.mode} · {detail?.duration_hours}h</p>
              </DialogHeader>

              {detail && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> Enroll Employees</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 border rounded">
                        {employees.map((e) => {
                          const already = detail.enrollments?.some((en) => en.employee_id === e.id);
                          return (
                            <label key={e.id} className={`flex items-center gap-2 text-sm ${already ? "opacity-50" : ""}`}>
                              <Checkbox
                                checked={!!enrollIds[e.id]}
                                disabled={already}
                                onCheckedChange={(v) => setEnrollIds({ ...enrollIds, [e.id]: !!v })}
                              />
                              <span>{e.name}</span>
                              {already && <Badge variant="outline" className="text-[10px]">enrolled</Badge>}
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-right">
                        <Button size="sm" onClick={enrollSelected}><UserPlus className="h-4 w-4 mr-1" /> Enroll Selected</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead><TableHead>Status</TableHead>
                        <TableHead>Score</TableHead><TableHead>Completed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.enrollments || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No enrollments.</TableCell></TableRow>}
                      {(detail.enrollments || []).map((en) => (
                        <TableRow key={en.id}>
                          <TableCell>{en.employee_name}</TableCell>
                          <TableCell>
                            <Select value={en.status} onValueChange={(v: any) => updateEnrollment(en, { status: v })}>
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="enrolled">Enrolled</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="dropped">Dropped</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-20"
                              defaultValue={en.score ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : Number(e.target.value);
                                if (v !== en.score) updateEnrollment(en, { score: v });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="w-36"
                              defaultValue={en.completed_date || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (en.completed_date || "")) updateEnrollment(en, { completed_date: e.target.value || null });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => removeEnrollment(en)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
