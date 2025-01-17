(define-structure
  (point (constructor silently-make-point (window #!optional x y)))
  (window #f read-only #t)
  (id (get-id) read-only #t)
  (x 0)
  (y 0))

(define (make-point window #!optional x y)
  (let ((x (if (and (not (default-object? x)) (literal-number? x)) (simplify x) x))
        (y (if (and (not (default-object? y)) (literal-number? y)) (simplify y) y)))
    (assert (window? window))
    (define point (silently-make-point window x y))
    (window-add-to-env window (extract-symbols (point-x point)))
    (window-add-to-env window (extract-symbols (point-y point)))
    (set-window-points! window
      (cons (list (point-id point) point) (window-points window)))
    (send-window window #t)
    point))

(define (eval-point point)
  (assert (point? point))
  (let ((env (window-env (point-window point))))
    (list (point-id point)
          (eval-expr env (point-x point))
          (eval-expr env (point-y point)))))

; case 1:
