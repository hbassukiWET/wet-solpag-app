import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";

interface ConfirmationScreenProps {
  numSP: string;
  driveUrl?: string;
  onNewRequest: () => void;
}

const ConfirmationScreen = ({ numSP, driveUrl, onNewRequest }: ConfirmationScreenProps) => {
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <Card className="glass-card overflow-hidden">
        <div className="h-1 bg-success" />
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>

          <div>
            <h2 className="text-xl font-heading font-bold mb-1">¡Solicitud Generada!</h2>
            <p className="text-muted-foreground">
              Solicitud de Pago <strong className="text-foreground">#{numSP}</strong> creada exitosamente
            </p>
          </div>

          <div className="space-y-3">
            {driveUrl && (
              <Button asChild variant="outline" className="w-full gap-2">
                <a href={driveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Ver archivo en Drive
                </a>
              </Button>
            )}
            <Button onClick={onNewRequest} className="w-full gap-2">
              <FileText className="w-4 h-4" />
              Nueva Solicitud
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmationScreen;
