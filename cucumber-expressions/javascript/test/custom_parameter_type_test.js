/* eslint-env mocha */
'use strict'

const assert = require('assert')
const assertThrows = require('./assert_throws')
const CucumberExpression = require('../src/cucumber_expression')
const RegularExpression = require('../src/regular_expression')
const ParameterTypeRegistry = require('../src/parameter_type_registry')
const ParameterType = require('../src/parameter_type')

class Color {
  /// [color-constructor]
  constructor(name) {
    this.name = name
  }
  /// [color-constructor]
}

class CssColor {
  constructor(name) {
    this.name = name
  }
}

describe('Custom parameter type', () => {
  let parameterTypeRegistry

  beforeEach(() => {
    parameterTypeRegistry = new ParameterTypeRegistry()
    /// [add-color-parameter-type]
    parameterTypeRegistry.defineParameterType(
      new ParameterType(
        'color',
        /red|blue|yellow/,
        Color,
        s => new Color(s),
        false,
        true
      )
    )
    /// [add-color-parameter-type]
  })

  describe('CucumberExpression', () => {
    it('matches parameters with custom parameter type', () => {
      const expression = new CucumberExpression(
        'I have a {color} ball',
        parameterTypeRegistry
      )
      const value = expression.match('I have a red ball')[0].value
      assert.equal(value.name, 'red')
    })

    it('matches parameters with multiple capture groups', () => {
      class Coordinate {
        constructor(x, y, z) {
          this.x = x
          this.y = y
          this.z = z
        }
      }

      parameterTypeRegistry.defineParameterType(
        new ParameterType(
          'coordinate',
          /(\d+),\s*(\d+),\s*(\d+)/,
          Coordinate,
          (x, y, z) => new Coordinate(parseInt(x), parseInt(y), parseInt(z)),
          true,
          true
        )
      )
      const expression = new CucumberExpression(
        'A {int} thick line from {coordinate} to {coordinate}',
        parameterTypeRegistry
      )
      const args = expression.match('A 5 thick line from 10,20,30 to 40,50,60')

      const thick = args[0].value
      assert.equal(thick, 5)

      const from = args[1].value
      assert.equal(from.x, 10)
      assert.equal(from.y, 20)
      assert.equal(from.z, 30)

      const to = args[2].value
      assert.equal(to.x, 40)
      assert.equal(to.y, 50)
      assert.equal(to.z, 60)
    })

    it('matches parameters with custom parameter type using optional capture group', () => {
      parameterTypeRegistry = new ParameterTypeRegistry()
      parameterTypeRegistry.defineParameterType(
        new ParameterType(
          'color',
          [/red|blue|yellow/, /(?:dark|light) (?:red|blue|yellow)/],
          Color,
          s => new Color(s),
          false,
          true
        )
      )
      const expression = new CucumberExpression(
        'I have a {color} ball',
        parameterTypeRegistry
      )
      const value = expression.match('I have a dark red ball')[0].value
      assert.equal(value.name, 'dark red')
    })

    it('defers transformation until queried from argument', () => {
      parameterTypeRegistry.defineParameterType(
        new ParameterType(
          'throwing',
          /bad/,
          null,
          s => {
            throw new Error(`Can't transform [${s}]`)
          },
          false,
          true
        )
      )

      const expression = new CucumberExpression(
        'I have a {throwing} parameter',
        parameterTypeRegistry
      )
      const args = expression.match('I have a bad parameter')
      assertThrows(() => args[0].value, "Can't transform [bad]")
    })

    describe('conflicting parameter type', () => {
      it('is detected for type name', () => {
        assertThrows(
          () =>
            parameterTypeRegistry.defineParameterType(
              new ParameterType(
                'color',
                /.*/,
                CssColor,
                s => new CssColor(s),
                false,
                true
              )
            ),
          'There is already a parameter type with name color'
        )
      })

      it('is not detected for type', () => {
        parameterTypeRegistry.defineParameterType(
          new ParameterType(
            'whatever',
            /.*/,
            Color,
            s => new Color(s),
            false,
            true
          )
        )
      })

      it('is not detected for regexp', () => {
        parameterTypeRegistry.defineParameterType(
          new ParameterType(
            'css-color',
            /red|blue|yellow/,
            CssColor,
            s => new CssColor(s),
            true,
            false
          )
        )

        assert.equal(
          new CucumberExpression(
            'I have a {css-color} ball',
            parameterTypeRegistry
          ).match('I have a blue ball')[0].value.constructor,
          CssColor
        )
        assert.equal(
          new CucumberExpression(
            'I have a {css-color} ball',
            parameterTypeRegistry
          ).match('I have a blue ball')[0].value.name,
          'blue'
        )
        assert.equal(
          new CucumberExpression(
            'I have a {color} ball',
            parameterTypeRegistry
          ).match('I have a blue ball')[0].value.constructor,
          Color
        )
        assert.equal(
          new CucumberExpression(
            'I have a {color} ball',
            parameterTypeRegistry
          ).match('I have a blue ball')[0].value.name,
          'blue'
        )
      })
    })

    // JavaScript-specific
    it('creates arguments using async transform', async () => {
      parameterTypeRegistry = new ParameterTypeRegistry()
      /// [add-async-parameter-type]
      parameterTypeRegistry.defineParameterType(
        new ParameterType(
          'asyncColor',
          /red|blue|yellow/,
          Color,
          async s => new Color(s),
          false,
          true
        )
      )
      /// [add-async-parameter-type]

      const expression = new CucumberExpression(
        'I have a {asyncColor} ball',
        parameterTypeRegistry
      )
      const args = await expression.match('I have a red ball')
      const value = await args[0].value
      assert.equal(value.name, 'red')
    })
  })

  describe('RegularExpression', () => {
    it('matches arguments with custom parameter type', () => {
      const expression = new RegularExpression(
        /I have a (red|blue|yellow) ball/,
        parameterTypeRegistry
      )
      const value = expression.match('I have a red ball')[0].value
      assert.equal(value.constructor, Color)
      assert.equal(value.name, 'red')
    })
  })
})
