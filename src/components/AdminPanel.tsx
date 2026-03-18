import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings, Save } from "lucide-react";

interface AdminPanelProps {
  currentConsecutivo: number;
  onUpdateConsecutivo: (newValue: number) => void;
}

const AdminPanel = ({ currentConsecutivo, onUpdateConsecutivo }: AdminPanelProps) => {
  const [newValue, setNewValue] = useState(String(currentConsecutivo).padStart(3, '0'));
  const [showConfirm, setShowConfirm] = useState(false);

  const parsedValue = parseInt(newValue, 10);
  const nextSP = isNaN(parsedValue) ? '---' : String(parsedValue + 1).padStart(3, '0');
  const currentYear = new Date().getFullYear().toString().slice(-2);

  const handleSave = () => {
    if (isNaN(parsedValue)) return;
    setShowConfirm(true);
  };

  const confirmSave = () => {
    onUpdateConsecutivo(parsedValue);
    setShowConfirm(false);
  };

  return (
    <>
      <div className="max-w-lg mx-auto">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Gestión de Consecutivo</CardTitle>
                <CardDescription>Administra el número de solicitud de pago</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">SP actual</p>
              <p className="text-3xl font-heading font-bold">
                {String(currentConsecutivo).padStart(3, '0')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newConsecutivo">Nuevo valor de consecutivo</Label>
              <Input
                id="newConsecutivo"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="070"
                className="font-mono text-lg"
              />
              {!isNaN(parsedValue) && (
                <p className="text-xs text-muted-foreground">
                  La siguiente solicitud será: <strong>SP-{currentYear}_{nextSP}</strong>
                </p>
              )}
            </div>

            <Button onClick={handleSave} disabled={isNaN(parsedValue)} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Guardar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio de consecutivo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cambiar el consecutivo a <strong className="text-foreground">{String(parsedValue).padStart(3, '0')}</strong>?
              <br /><br />
              La siguiente solicitud será <strong className="text-foreground">SP-{currentYear}_{nextSP}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={confirmSave}>Sí, cambiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPanel;
