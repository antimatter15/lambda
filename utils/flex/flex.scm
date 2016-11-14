(define flexs '())

(define maxiter 10)
(define estimate 1)
(define ftol 0.000001)

(define (rand . args) (exact->inexact (/ (random 100) 1000)))
(define (free . args) #t)

(define (get-flex id)
  (let ((match (assq id flexs)))
    (and match (cdr match))))

(define (map-args f v)
  (make-initialized-vector (car (arity f)) v))

(define (fix-eval goal init vals)
  (vector-map
    (lambda (goal-val init-val val)
      (if (false? goal-val) init-val val))
    (cdr goal) init vals))

(define (fix-goal goal init vals)
  (vector-map
    (lambda (goal-val init-val val)
      (cond ((number? goal-val) goal-val)
        ((true? goal-val) init-val)
        ((false? goal-val) val)))
    (cdr goal) init vals))

(define (make-fn function goal init)
  (lambda (vals)
    (apply function (vector->list (fix-eval goal init vals)))))

(define (make-fn-g function-g goal init)
  (lambda (vals)
    (let ((app (apply function-g (vector->list (fix-eval goal init vals)))))
      (if (down? app) (vector->up (down->vector app)) (up app)))))

(define (make-out-err fn goal)
  (lambda (vals)
    (square (- (car goal) (fn vals)))))

(define (make-out-err-g fn fn-g goal)
  (lambda (vals)
    (* 2
      (- (car goal) (fn vals))
      (fn-g vals))))

(define (make-val-err fn goal init)
  (lambda (vals)
    (let ((delta (- (fix-goal goal init vals) vals)))
      (dot-product delta delta))))

(define (make-val-err-g fn fn-g goal init)
  (lambda (vals)
    (* 2 (- (fix-goal goal init vals) vals))))

(define (make-m out-err val-err)
  (lambda (vals)
    (+ (val-err vals) (out-err vals))))

(define (make-m-g out-err-g val-err-g)
  (lambda (vals)
    (- (+ (out-err-g vals) (val-err-g vals)))))

(define (pull-flex id out #!optional goals)
  ((flex-pull (get-flex id)) out goals)
  '*silence*)

(define (push-flex id vals)
  (let ((flex (get-flex id)))
    (set-flex-vals! flex vals)
    (set-flex-out! flex (apply (flex-f flex) (vector->list vals)))
    (send-flex flex))
  '*silence*)

(define-structure (flex (constructor *make-flex* (f out vals args body)))
  (id (get-id) read-only #t)
  (f #f read-only #t)
  (g #f read-only #t)
  (pull #f)
  (out #f)
  (vals #f)
  (args #f read-only #t)
  (body #f read-only #t))

(define (send-flex flex)
  (send-data
    (array->json
      (list 2
        (flex-id flex)
        (flex-out flex)
        (flex-vals flex)
        (flex-args flex)))))

(define (make-flex f #!optional init)
  (let* ((g (D f))
         (literal (unsyntax f))
         (args (cadr literal))
         (body (cddr literal))
         (init (if (default-object? init) (map-args f rand) init))
         (init-out (apply f (vector->list init)))
         (free (map-args f free)))
    (define flex (*make-flex* f init-out init args body))
    (define (pull out #!optional goals)
      (let ((goal (cons out (if (default-object? goals) free goals)))
            (init (flex-vals flex)))
        (let ((fn (make-fn f goal init))
              (fn-g (make-fn-g g goal init)))
          (let ((out-err (make-out-err fn goal))
                (out-err-g (make-out-err-g fn fn-g goal))
                (val-err (make-val-err fn goal init))
                (val-err-g (make-val-err-g fn fn-g goal init)))
            (let ((m (make-m out-err val-err))
                  (m-g (make-m-g out-err-g val-err-g)))
              (let ((vals (caadr (bfgs m m-g init estimate ftol maxiter))))
                (set-flex-vals! flex vals)
                (set-flex-out! flex (fn vals))
                (send-flex flex)))))))
    (pull init-out init)
    (set-flex-pull! flex pull)
    (set! flexs (cons (cons (flex-id flex) flex) flexs))
    '*silence*))