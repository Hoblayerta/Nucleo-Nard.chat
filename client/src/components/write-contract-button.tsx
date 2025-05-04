import { useState } from "react";
import { writeToContractFrontend } from "@/lib/writesm";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readFromContract } from "@/lib/writesm";
import { useQuery } from "@tanstack/react-query";

interface WriteContractButtonProps extends Omit<ButtonProps, "onClick"> {
  postId?: number;
  showTopComments?: boolean;
}

export function WriteContractButton({
  postId,
  showTopComments = true,
  className,
  variant = "outline",
  size = "default",
  ...props
}: WriteContractButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [commentsType, setCommentsType] = useState<"mostLiked" | "recent">("mostLiked");
  const [limit, setLimit] = useState<string>("5");
  const [isIncludePost, setIsIncludePost] = useState(true);

  // Obtener los top comentarios o comentarios recientes
  const { data: topComments, isLoading: commentsLoading } = useQuery({
    queryKey: ["/api/comments/top", limit, commentsType],
    queryFn: async () => {
      const endpoint = commentsType === "mostLiked" ? "/api/comments/top" : "/api/comments/recent";
      const res = await fetch(`${endpoint}?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: open && showTopComments,
  });

  // Obtener el último valor del contrato
  const { data: contractValue, isLoading: contractValueLoading } = useQuery({
    queryKey: ["contractValue"],
    queryFn: async () => {
      try {
        const value = await readFromContract();
        return value as string;
      } catch (error) {
        console.error("Error reading contract value:", error);
        return "Error reading contract";
      }
    },
    enabled: open,
  });

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast({
        title: "Text is required",
        description: "Please enter some text to save to the blockchain",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await writeToContractFrontend(text);

      toast({
        title: "Transaction successful",
        description: "Your text has been saved to the blockchain",
      });

      setOpen(false);
      setText("");
    } catch (error) {
      console.error("Transaction error:", error);
      toast({
        title: "Transaction failed",
        description: error instanceof Error ? error.message : "Failed to save to blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar los top comentarios en el editor
  const loadComments = () => {
    if (!topComments) return;
    
    let content = "";
    
    // Si se incluye el post y hay un postId, agregarlo
    if (isIncludePost && postId) {
      content += `Post ID: ${postId}\n\n`;
    }
    
    // Agregar comentarios
    content += `${commentsType === "mostLiked" ? "Top" : "Recent"} ${limit} Comments:\n\n`;
    
    topComments.forEach((comment: any, index: number) => {
      content += `${index + 1}. User: ${comment.user.username} (${comment.user.role})\n`;
      content += `   Score: ${comment.voteScore} (${comment.upvotes}↑ ${comment.downvotes}↓)\n`;
      content += `   "${comment.content}"\n\n`;
    });
    
    content += `Saved on: ${new Date().toISOString()}\n`;
    content += `Arbitrum Sepolia Network`;
    
    setText(content);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className || ""}`}
        onClick={() => setOpen(true)}
        title="Guardar en la blockchain"
        {...props}
      >
        <Save className="h-4 w-4" />
        <span>Escribir en Contrato</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Escribir en Contrato de Blockchain</DialogTitle>
            <DialogDescription>
              Escribe texto para guardar permanentemente en la blockchain de Arbitrum Sepolia.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 overflow-y-auto">
            {showTopComments && (
              <div className="border rounded-md p-4 bg-muted/20">
                <h3 className="font-medium mb-2">Cargar comentarios automáticamente</h3>
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <Label className="min-w-[100px]">Tipo de comentarios:</Label>
                    <ToggleGroup type="single" value={commentsType} onValueChange={(value) => value && setCommentsType(value as "mostLiked" | "recent")}>
                      <ToggleGroupItem value="mostLiked" aria-label="Más votados">
                        Más votados
                      </ToggleGroupItem>
                      <ToggleGroupItem value="recent" aria-label="Más recientes">
                        Más recientes
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <Label className="min-w-[100px]">Número:</Label>
                    <Select value={limit} onValueChange={setLimit}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Límite" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Top 5</SelectItem>
                        <SelectItem value="10">Top 10</SelectItem>
                        <SelectItem value="15">Top 15</SelectItem>
                        <SelectItem value="20">Top 20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="include-post" 
                      checked={isIncludePost} 
                      onCheckedChange={setIsIncludePost} 
                    />
                    <Label htmlFor="include-post">Incluir ID del post</Label>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={loadComments}
                    disabled={commentsLoading}
                  >
                    {commentsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando comentarios...
                      </>
                    ) : (
                      "Cargar comentarios"
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="blockchain-text" className="text-right">
                Texto a guardar en la blockchain:
              </Label>
              <Textarea
                id="blockchain-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe el texto que quieres guardar permanentemente en la blockchain..."
                className="h-56 mt-1.5"
              />
            </div>

            {!contractValueLoading && contractValue && (
              <div className="text-sm text-muted-foreground">
                <Label className="text-xs font-medium mb-1 block">Último valor guardado en el contrato:</Label>
                <div className="border rounded-md p-2 bg-muted/10 text-xs max-h-20 overflow-y-auto break-all">
                  {contractValue}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar en blockchain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
