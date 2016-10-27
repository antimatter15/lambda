(load "/utils/output")
(load "/utils/json")
(load "/utils/print")

(load "/utils/canvas/canvas")
(load "/utils/canvas/graphics")

(load "/utils/latex/latex")

(load "/utils/flex/min")
(load "/utils/flex/flex")

(cd "/files")

(define flex (make-flex (lambda (x) (+ 1 (cube x)))))
