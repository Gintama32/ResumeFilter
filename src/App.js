import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FileUp, Search, Loader2, X, FileText, Star } from 'lucide-react';



// --- Helper Components ---

const Button = ({ children, onClick, className = '', variant = 'primary', ...props }) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2';
    const variantClasses = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
    };
    return (
        <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} onClick={onClick} {...props}>
            {children}
        </button>
    );
};

const ResumeCard = ({ resume, onSelect }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-800 break-all">{resume.name}</h3>
                    {resume.score > 0 && (
                        <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                            <Star className="w-3 h-3" />
                            <span>{resume.score} Match{resume.score > 1 ? 'es' : ''}</span>
                        </div>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                    {resume.content.substring(0, 150)}...
                </p>
            </div>
            <div className="mt-4">
                <Button onClick={() => onSelect(resume)} className="w-full" variant="secondary">
                    <FileText className="w-4 h-4 mr-2" />
                    View Text
                </Button>
            </div>
        </div>
    );
};

const ResumeViewerModal = ({ resume, onClose }) => {
    if (!resume) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">{resume.name}</h2>
                    <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full w-8 h-8">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">{resume.content}</pre>
                </div>
                <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

export default function App() {
    const [resumes, setResumes] = useState([]);
    const [keywords, setKeywords] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedResume, setSelectedResume] = useState(null);
    const [pdfJsReady, setPdfJsReady] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            setPdfJsReady(true);
        }
    }, []);

    const handleFileChange = useCallback(async (event) => {
        const files = Array.from(event.target.files).filter(f => f.type === 'application/pdf');
        if (files.length === 0) return;

        setIsLoading(true);
        setError(null);
        const newResumes = [];

        for (const file of files) {
            try {
                const fileReader = new FileReader();
                const extractedText = await new Promise((resolve, reject) => {
                    fileReader.onload = async (e) => {
                        try {
                            const typedarray = new Uint8Array(e.target.result);
                            const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                            let fullText = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                fullText += textContent.items.map(s => s.str).join(' ') + '\n';
                            }
                            resolve(fullText);
                        } catch (pdfError) {
                            console.error(`Error parsing PDF "${file.name}":`, pdfError);
                            reject(new Error(`Could not parse ${file.name}.`));
                        }
                    };
                    fileReader.onerror = () => reject(new Error('Error reading file.'));
                    fileReader.readAsArrayBuffer(file);
                });

                newResumes.push({ id: crypto.randomUUID(), name: file.name, content: extractedText });
            } catch (err) {
                 setError(`Failed to process ${file.name}. It might be corrupted or protected.`);
                 console.error(err);
            }
        }
        
        setResumes(prevResumes => {
            const existingNames = new Set(prevResumes.map(r => r.name));
            const uniqueNewResumes = newResumes.filter(r => !existingNames.has(r.name));
            return [...prevResumes, ...uniqueNewResumes];
        });

        setIsLoading(false);
        event.target.value = null;
    }, []);

    const filteredAndScoredResumes = useMemo(() => {
        const searchTerms = keywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);

        if (searchTerms.length === 0) {
            return resumes.map(r => ({ ...r, score: 0 }));
        }
        
        const scored = resumes.map(resume => {
            const lowerCaseContent = resume.content.toLowerCase();
            const matchedKeywords = new Set();
            searchTerms.forEach(term => {
                if (lowerCaseContent.includes(term)) {
                    matchedKeywords.add(term);
                }
            });
            return { ...resume, score: matchedKeywords.size };
        });

        return scored.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    }, [resumes, keywords]);

    return (
        <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
            <div className="container mx-auto p-4 md:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-indigo-600">Resume Keyword Filter</h1>
                    <p className="mt-2 text-lg text-gray-600">Upload PDF resumes and find the best candidates instantly.</p>
                </header>
                
                {error && (
                     <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                        <p className="font-bold">An Error Occurred</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <FileUp className="w-12 h-12 text-gray-400 mb-2" />
                            <h2 className="text-xl font-semibold mb-2">Upload Resumes</h2>
                            <p className="text-sm text-gray-500 mb-4">Drag & drop or click to select PDF files.</p>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                accept=".pdf"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isLoading || !pdfJsReady}
                            />
                            <Button onClick={() => document.getElementById('file-upload').click()} disabled={isLoading || !pdfJsReady}>
                                {isLoading ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing... </>
                                ) : !pdfJsReady ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading PDF Engine... </>
                                ) : ( 'Select Files' )}
                            </Button>
                        </div>
                        <div className="flex flex-col justify-center">
                            <h2 className="text-xl font-semibold mb-2">Filter by Keywords</h2>
                            <p className="text-sm text-gray-500 mb-4">Enter keywords separated by commas (e.g., react, nodejs, python).</p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="Enter keywords..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={resumes.length === 0}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                     {resumes.length > 0 ? (
                        <>
                            <h2 className="text-2xl font-bold mb-4">
                                {keywords ? `Matching Resumes (${filteredAndScoredResumes.length})` : `All Uploaded Resumes (${resumes.length})`}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(keywords ? filteredAndScoredResumes : resumes).map(resume => (
                                    <ResumeCard key={resume.id} resume={resume} onSelect={setSelectedResume} />
                                ))}
                            </div>
                            {keywords && filteredAndScoredResumes.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                                    <p className="text-gray-500">No resumes found matching your keywords.</p>
                                </div>
                            )}
                        </>
                    ) : (
                         <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold text-gray-700">Your resume list is empty</h3>
                            <p className="text-gray-500 mt-2">Upload some resumes to get started!</p>
                        </div>
                    )}
                </div>
            </div>
            
            <ResumeViewerModal resume={selectedResume} onClose={() => setSelectedResume(null)} />
        </div>
    );
}