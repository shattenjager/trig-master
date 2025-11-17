import { useState, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, ArrowClockwise, Lightning, Target, ClockCounterClockwise } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type TrigFunction = 'sin' | 'cos' | 'tan'
type Angle = 30 | 45 | 60

interface Question {
  func: TrigFunction
  angle: Angle
}

interface Stats {
  correct: number
  total: number
  currentStreak: number
  bestStreak: number
}

interface HistoryEntry {
  question: Question
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  timestamp: number
}

const CORRECT_ANSWERS: Record<string, string[]> = {
  'sin-30': ['1/2', '0.5', '.5'],
  'sin-45': ['√2/2', '0.707', '0.7071', '1/√2', 'sqrt(2)/2'],
  'sin-60': ['√3/2', '0.866', '0.8660', 'sqrt(3)/2'],
  'cos-30': ['√3/2', '0.866', '0.8660', 'sqrt(3)/2'],
  'cos-45': ['√2/2', '0.707', '0.7071', '1/√2', 'sqrt(2)/2'],
  'cos-60': ['1/2', '0.5', '.5'],
  'tan-30': ['√3/3', '0.577', '0.5773', '1/√3', 'sqrt(3)/3'],
  'tan-45': ['1', '1.0'],
  'tan-60': ['√3', '1.732', '1.7320', 'sqrt(3)'],
}

const DROPDOWN_OPTIONS = [
  { value: '1/2', label: '1/2' },
  { value: '√2/2', label: '√2/2' },
  { value: '√3/2', label: '√3/2' },
  { value: '√3/3', label: '√3/3' },
  { value: '1', label: '1' },
  { value: '√3', label: '√3' },
]

function generateQuestion(previousQuestion?: Question): Question {
  const functions: TrigFunction[] = ['sin', 'cos', 'tan']
  const angles: Angle[] = [30, 45, 60]
  
  let newQuestion: Question
  do {
    newQuestion = {
      func: functions[Math.floor(Math.random() * functions.length)],
      angle: angles[Math.floor(Math.random() * angles.length)]
    }
  } while (
    previousQuestion && 
    newQuestion.func === previousQuestion.func && 
    newQuestion.angle === previousQuestion.angle
  )
  
  return newQuestion
}

function checkAnswer(question: Question, userAnswer: string): boolean {
  const key = `${question.func}-${question.angle}`
  const correctAnswers = CORRECT_ANSWERS[key]
  const normalized = userAnswer.trim().toLowerCase().replace(/\s/g, '')
  
  return correctAnswers.some(correct => {
    const normalizedCorrect = correct.toLowerCase().replace(/\s/g, '')
    if (normalized === normalizedCorrect) return true
    
    const evaluateExpression = (expr: string): number => {
      if (expr.includes('/')) {
        const [num, denom] = expr.split('/')
        const numerator = parseFloat(num)
        const denominator = parseFloat(denom)
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return numerator / denominator
        }
      }
      return parseFloat(expr)
    }
    
    const userNum = evaluateExpression(normalized)
    const correctNum = evaluateExpression(normalizedCorrect)
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      return Math.abs(userNum - correctNum) < 0.001
    }
    
    return false
  })
}

function App() {
  const [stats, setStats] = useKV<Stats>('trig-stats', {
    correct: 0,
    total: 0,
    currentStreak: 0,
    bestStreak: 0
  })
  
  const [history, setHistory] = useKV<HistoryEntry[]>('trig-history', [])
  
  const [question, setQuestion] = useState<Question>(generateQuestion())
  const [userAnswer, setUserAnswer] = useState('')
  const [inputMode, setInputMode] = useState<'type' | 'select'>('select')
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    inputRef.current?.focus()
  }, [question])
  
  const handleSubmit = async () => {
    if (!userAnswer.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    const isCorrect = checkAnswer(question, userAnswer)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    
    const key = `${question.func}-${question.angle}`
    const correctAnswer = CORRECT_ANSWERS[key][0]
    
    setHistory((currentHistory) => [
      {
        question: { ...question },
        userAnswer: userAnswer.trim(),
        correctAnswer,
        isCorrect,
        timestamp: Date.now()
      },
      ...(currentHistory || [])
    ])
    
    setStats((current) => {
      if (!current) {
        return {
          correct: isCorrect ? 1 : 0,
          total: 1,
          currentStreak: isCorrect ? 1 : 0,
          bestStreak: isCorrect ? 1 : 0
        }
      }
      
      const newTotal = current.total + 1
      const newCorrect = isCorrect ? current.correct + 1 : current.correct
      const newStreak = isCorrect ? current.currentStreak + 1 : 0
      const newBestStreak = Math.max(current.bestStreak, newStreak)
      
      return {
        correct: newCorrect,
        total: newTotal,
        currentStreak: newStreak,
        bestStreak: newBestStreak
      }
    })
    
    if (isCorrect) {
      toast.success('Correct!', {
        description: `${question.func}(${question.angle}°) = ${userAnswer}`
      })
    } else {
      toast.error('Not quite', {
        description: `The answer is ${correctAnswer}`
      })
    }
    
    setTimeout(() => {
      setQuestion(generateQuestion(question))
      setUserAnswer('')
      setFeedback(null)
      setIsSubmitting(false)
      setShowHint(false)
    }, 1500)
  }
  
  const handleReset = () => {
    const newQuestion = generateQuestion(question)
    setStats({
      correct: 0,
      total: 0,
      currentStreak: 0,
      bestStreak: stats?.bestStreak || 0
    })
    setHistory([])
    setQuestion(newQuestion)
    setUserAnswer('')
    setFeedback(null)
    toast.success('Stats reset!', {
      description: 'Starting fresh practice session'
    })
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit()
    }
  }
  
  const accuracy = (stats?.total || 0) > 0 ? Math.round(((stats?.correct || 0) / (stats?.total || 0)) * 100) : 0
  
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Trig Master
          </h1>
          <p className="text-muted-foreground">
            Master sine, cosine, and tangent values
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 flex flex-col items-center gap-2 bg-card border-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target size={20} weight="duotone" />
              <span className="text-sm font-medium">Accuracy</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {accuracy}%
            </div>
            <Progress value={accuracy} className="w-full h-2" />
          </Card>
          
          <Card className="p-4 flex flex-col items-center gap-2 bg-card border-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lightning size={20} weight="duotone" />
              <span className="text-sm font-medium">Streak</span>
            </div>
            <div className="text-3xl font-bold text-accent">
              {stats?.currentStreak || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Best: {stats?.bestStreak || 0}
            </div>
          </Card>
          
          <Card className="p-4 flex flex-col items-center gap-2 bg-card border-2">
            <div className="text-sm font-medium text-muted-foreground">
              Score
            </div>
            <div className="text-3xl font-bold text-secondary-foreground">
              {stats?.correct || 0}/{stats?.total || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              correct answers
            </div>
          </Card>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={`${question.func}-${question.angle}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-8 sm:p-12 bg-card border-2 relative overflow-hidden">
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 flex items-center justify-center ${
                      feedback === 'correct'
                        ? 'bg-accent/20'
                        : 'bg-destructive/20'
                    }`}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      {feedback === 'correct' ? (
                        <Check size={80} weight="bold" className="text-accent" />
                      ) : (
                        <X size={80} weight="bold" className="text-destructive" />
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="text-center mb-8">
                <div className="text-5xl sm:text-6xl font-semibold text-foreground mb-4">
                  {question.func}({question.angle}°) = ?
                </div>
                <AnimatePresence>
                  {feedback === 'incorrect' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4"
                    >
                      <p className="text-destructive font-medium text-lg">
                        Correct answer: {CORRECT_ANSWERS[`${question.func}-${question.angle}`][0]}
                      </p>
                    </motion.div>
                  )}
                  {!feedback && (
                    <p className="text-muted-foreground">
                      Enter the value
                    </p>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant={inputMode === 'select' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setInputMode('select')
                      setUserAnswer('')
                    }}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Select Answer
                  </Button>
                  <Button
                    type="button"
                    variant={inputMode === 'type' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setInputMode('type')
                      setUserAnswer('')
                      setTimeout(() => inputRef.current?.focus(), 0)
                    }}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Type Answer
                  </Button>
                </div>

                {inputMode === 'select' ? (
                  <Select
                    value={userAnswer}
                    onValueChange={setUserAnswer}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="text-center text-2xl sm:text-3xl h-16 font-medium">
                      <SelectValue placeholder="Choose a value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DROPDOWN_OPTIONS.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="text-xl font-medium cursor-pointer"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="e.g., 0.5 or 1/2"
                      className="text-center text-2xl sm:text-3xl h-16 font-medium pr-16"
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserAnswer(prev => prev + '√')
                        inputRef.current?.focus()
                      }}
                      disabled={isSubmitting}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 p-0 text-xl font-bold hover:bg-accent hover:text-accent-foreground"
                      title="Insert radical sign"
                    >
                      √
                    </Button>
                  </div>
                )}
                
                <Button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim() || isSubmitting}
                  className="w-full h-12 text-lg font-semibold"
                  size="lg"
                >
                  {isSubmitting ? 'Checking...' : 'Submit Answer'}
                </Button>
                
                {inputMode === 'type' && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showHint ? 'Hide hint' : 'Show accepted formats'}
                  </button>
                )}
                
                {inputMode === 'type' && showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-sm text-muted-foreground text-center space-y-1 pt-2"
                  >
                    <p>You can use:</p>
                    <p>Decimals: 0.5, 0.707, 0.866</p>
                    <p>Fractions: 1/2</p>
                    <p>Radicals: √2/2, √3/2, √3</p>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
        
        <div className="mt-6 flex justify-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2"
              >
                <ClockCounterClockwise size={18} />
                Answer History
                {(history?.length || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {history?.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Answer History</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                {(!history || history.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClockCounterClockwise size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No answers yet</p>
                    <p className="text-sm mt-1">Start practicing to see your history</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry, index) => (
                      <motion.div
                        key={entry.timestamp}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card className={`p-4 border-2 ${
                          entry.isCorrect 
                            ? 'border-accent/30 bg-accent/5' 
                            : 'border-destructive/30 bg-destructive/5'
                        }`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`rounded-full p-1.5 ${
                                  entry.isCorrect ? 'bg-accent/20' : 'bg-destructive/20'
                                }`}>
                                  {entry.isCorrect ? (
                                    <Check size={20} weight="bold" className="text-accent" />
                                  ) : (
                                    <X size={20} weight="bold" className="text-destructive" />
                                  )}
                                </div>
                                <div className="text-lg font-semibold">
                                  {entry.question.func}({entry.question.angle}°)
                                </div>
                                <Badge variant={entry.isCorrect ? "default" : "destructive"}>
                                  {entry.isCorrect ? 'Correct' : 'Wrong'}
                                </Badge>
                              </div>
                              <div className="ml-11 space-y-1 text-sm">
                                <div className="flex gap-2">
                                  <span className="text-muted-foreground">Your answer:</span>
                                  <span className={`font-medium ${
                                    entry.isCorrect ? 'text-accent' : 'text-destructive'
                                  }`}>
                                    {entry.userAnswer}
                                  </span>
                                </div>
                                {!entry.isCorrect && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Correct answer:</span>
                                    <span className="font-medium text-accent">
                                      {entry.correctAnswer}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
          
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <ArrowClockwise size={18} />
            Reset Stats
          </Button>
        </div>
        
        {(stats?.total || 0) === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <Card className="p-6 bg-secondary/30 border-secondary">
              <p className="text-sm text-secondary-foreground">
                💡 <strong>Tip:</strong> Common values to memorize:
              </p>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>sin(30°) = cos(60°) = 1/2</p>
                <p>sin(45°) = cos(45°) = √2/2 ≈ 0.707</p>
                <p>sin(60°) = cos(30°) = √3/2 ≈ 0.866</p>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default App
