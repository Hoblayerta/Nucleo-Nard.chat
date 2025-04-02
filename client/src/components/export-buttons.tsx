import { Download, FileText } from "lucide-react";

interface ExportButtonsProps {
  postId: number;
  postTitle: string;
}

export default function ExportButtons({ postId, postTitle }: ExportButtonsProps) {
  const sanitizedTitle = postTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  
  return (
    <div className="bg-blue-50 rounded-lg shadow-sm p-4 mb-6 border border-blue-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <h3 className="text-md font-semibold text-blue-900">Opciones de Exportación:</h3>
        <div className="flex flex-col gap-2">
          <div className="text-sm text-gray-700">Descargar contenido como:</div>
          <div className="flex flex-wrap gap-2">
            <a 
              href={`/api/posts/${postId}/comments/export`}
              className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              download={`comentarios-post-${postId}.csv`}
            >
              <Download className="h-4 w-4 mr-1" />
              <span>CSV</span>
            </a>
            <a 
              href={`/api/posts/${postId}/comments/export-text`}
              className="flex items-center px-3 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors"
              download={`post-${postId}-${sanitizedTitle}.txt`}
            >
              <FileText className="h-4 w-4 mr-1" />
              <span>Texto plano</span>
            </a>
            <a 
              href={`/api/posts/${postId}/comments/export-word`}
              className="flex items-center px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
              download={`post-${postId}-${sanitizedTitle}.docx`}
            >
              <FileText className="h-4 w-4 mr-1" />
              <span>Word (DOCX)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}